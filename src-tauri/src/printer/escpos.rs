use std::time::Duration;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;

use crate::models::BillReceipt;
use crate::printer::format_minor_money;

fn truncate_pad(s: &str, width: usize) -> String {
    let chars: Vec<char> = s.chars().collect();
    if chars.len() >= width {
        let mut out: String = chars[..width.saturating_sub(1)].iter().collect();
        if width > 0 {
            out.push(' ');
        }
        out
    } else {
        format!("{s:<width$}")
    }
}

pub fn format_receipt_bytes(
    shop_name: &str,
    shop_subtitle: &str,
    currency_symbol: &str,
    receipt_footer: &str,
    bill: &BillReceipt,
    width_mm: u16,
) -> Vec<u8> {
    let is_58 = width_mm <= 58;
    let cols: usize = if is_58 { 32 } else { 48 };
    let (w_name, w_qty, w_tot) = if is_58 { (16, 4, 12) } else { (26, 6, 16) };

    let mut buf: Vec<u8> = Vec::with_capacity(1024);
    buf.extend_from_slice(&[0x1B, 0x40]); // Init
    buf.extend_from_slice(&[0x1B, 0x61, 1]); // Center
    buf.extend_from_slice(&[0x1D, 0x21, 0x11]); // Double H/W
    buf.extend_from_slice(&[0x1B, 0x45, 1]); // Bold on
    buf.extend_from_slice(shop_name.as_bytes());
    buf.push(b'\n');
    buf.extend_from_slice(&[0x1D, 0x21, 0x00]); // Normal size
    buf.extend_from_slice(&[0x1B, 0x45, 0]); // Bold off
    if !shop_subtitle.trim().is_empty() {
        buf.extend_from_slice(format!("{}\n", shop_subtitle.trim()).as_bytes());
    }

    if bill.voided {
        buf.extend_from_slice(b"*** VOIDED RECEIPT ***\n");
    }
    buf.extend_from_slice(&[0x1B, 0x61, 0]); // Align left

    let date_part = bill.hlc.get(..19).unwrap_or(&bill.hlc).replace('T', " ");
    buf.extend_from_slice(format!("Bill: {}\n", bill.bill_no).as_bytes());
    buf.extend_from_slice(format!("Time: {date_part} UTC\n").as_bytes());
    buf.extend_from_slice(format!("Pay : {}  Node: {}\n", bill.payment_mode, bill.node_id).as_bytes());

    let sep = "-".repeat(cols);
    buf.extend_from_slice(format!("{sep}\n").as_bytes());
    buf.extend_from_slice(
        format!(
            "{:<w_name$}{:>w_qty$}{:>w_tot$}\n",
            "Item", "Qty", "Total"
        )
        .as_bytes(),
    );
    buf.extend_from_slice(format!("{sep}\n").as_bytes());

    for item in &bill.items {
        let name_col = truncate_pad(&item.name, w_name);
        let qty_str = format!("{}", item.qty);
        let tot_str = format_minor_money(item.line_total_minor, currency_symbol);
        buf.extend_from_slice(
            format!("{name_col}{qty_str:>w_qty$}{tot_str:>w_tot$}\n").as_bytes(),
        );
    }

    buf.extend_from_slice(format!("{sep}\n").as_bytes());
    if bill.discount_minor > 0 {
        let disc = format_minor_money(-bill.discount_minor, currency_symbol);
        let label_w = cols.saturating_sub(disc.len());
        buf.extend_from_slice(format!("{:<label_w$}{disc}\n", "Discount").as_bytes());
    }

    buf.extend_from_slice(&[0x1B, 0x45, 1]); // Bold on
    let total_str = format_minor_money(bill.total_minor, currency_symbol);
    let tot_label_w = cols.saturating_sub(total_str.len());
    buf.extend_from_slice(format!("{:<tot_label_w$}{total_str}\n", "TOTAL").as_bytes());
    buf.extend_from_slice(&[0x1B, 0x45, 0]); // Bold off

    buf.extend_from_slice(format!("{sep}\n").as_bytes());
    buf.extend_from_slice(&[0x1B, 0x61, 1]); // Center
    let footer = if receipt_footer.trim().is_empty() {
        "Thank you for shopping!"
    } else {
        receipt_footer.trim()
    };
    buf.extend_from_slice(format!("{footer}\n").as_bytes());
    buf.extend_from_slice(b"Kura Offline POS\n");
    buf.extend_from_slice(&[0x1B, 0x64, 0x04]); // Feed 4 lines
    buf.extend_from_slice(&[0x1D, 0x56, 0x42, 0x00]); // Cut paper
    buf
}

pub async fn send_tcp_print(ip: &str, port: u16, bytes: &[u8]) -> Result<(), String> {
    let addr = format!("{}:{port}", ip.trim());
    let mut stream = tokio::time::timeout(Duration::from_secs(3), TcpStream::connect(&addr))
        .await
        .map_err(|_| format!("Thermal printer {addr} timed out (3s)"))?
        .map_err(|e| format!("Cannot connect to printer {addr}: {e}"))?;

    tokio::time::timeout(Duration::from_secs(3), stream.write_all(bytes))
        .await
        .map_err(|_| "Timed out sending receipt bytes".to_string())?
        .map_err(|e| format!("Failed writing to printer: {e}"))?;

    let _ = stream.flush().await;
    Ok(())
}
