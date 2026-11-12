use base64::{engine::general_purpose::STANDARD, Engine};
use std::path::Path;

use crate::models::{PdfExportResult, Product};
use crate::printer::format_minor_money;

// Code-39 9-element patterns (5 bars, 4 spaces; 1=wide, 0=narrow)
const C39: [(char, u16); 44] = [
    ('0', 0b000110100), ('1', 0b100100001), ('2', 0b001100001), ('3', 0b101100000),
    ('4', 0b000110001), ('5', 0b100110000), ('6', 0b001110000), ('7', 0b000100101),
    ('8', 0b100100100), ('9', 0b001100100), ('A', 0b100001001), ('B', 0b001001001),
    ('C', 0b101001000), ('D', 0b000011001), ('E', 0b100011000), ('F', 0b001011000),
    ('G', 0b000001101), ('H', 0b100001100), ('I', 0b001001100), ('J', 0b000011100),
    ('K', 0b100000011), ('L', 0b001000011), ('M', 0b101000010), ('N', 0b000010011),
    ('O', 0b100010010), ('P', 0b001010010), ('Q', 0b000000111), ('R', 0b100000110),
    ('S', 0b001000110), ('T', 0b000010110), ('U', 0b110000001), ('V', 0b011000001),
    ('W', 0b111000000), ('X', 0b010010001), ('Y', 0b110010000), ('Z', 0b011010000),
    ('-', 0b010000101), ('.', 0b110000100), (' ', 0b011000100), ('$', 0b010101000),
    ('/', 0b010100010), ('+', 0b010001010), ('%', 0b000101010), ('*', 0b010010100),
];

fn pdf_esc(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            '(' => out.push_str("\\("),
            ')' => out.push_str("\\)"),
            '\\' => out.push_str("\\\\"),
            c if c.is_ascii() => out.push(c),
            _ => out.push(' '),
        }
    }
    out
}

fn c39_pattern(ch: char) -> u16 {
    let up = ch.to_ascii_uppercase();
    C39.iter().find(|(c, _)| *c == up).map(|(_, p)| *p).unwrap_or(0b010000101)
}

fn draw_code39(stream: &mut String, code: &str, x0: f32, y0: f32, max_w: f32, h: f32) {
    let clean: String = code
        .chars()
        .map(|c| c.to_ascii_uppercase())
        .filter(|c| C39.iter().any(|(k, _)| k == c && *k != '*'))
        .take(18)
        .collect();
    let full = format!("*{clean}*");
    // Each char has 6 narrow + 3 wide (ratio 2.4 -> ~13.2 narrow units) + 1 narrow gap
    let total_units = (full.len() as f32) * 14.2;
    let unit = (max_w / total_units).min(1.05).max(0.42);
    let actual_w = total_units * unit;
    let mut cx = x0 + (max_w - actual_w).max(0.0) * 0.5;

    stream.push_str("0 0 0 rg\n");
    for ch in full.chars() {
        let pat = c39_pattern(ch);
        for i in 0..9 {
            let wide = ((pat >> (8 - i)) & 1) == 1;
            let w = if wide { unit * 2.4 } else { unit };
            if i % 2 == 0 {
                stream.push_str(&format!("{cx:.2} {y0:.2} {w:.2} {h:.2} re f\n"));
            }
            cx += w;
        }
        cx += unit;
    }
}

fn draw_label_cell(
    stream: &mut String,
    shop: &str,
    sym: &str,
    p: &Product,
    x: f32,
    y: f32,
    w: f32,
    h: f32,
) {
    stream.push_str(&format!("0.9 0.9 0.92 RG 0.5 w {x:.1} {y:.1} {w:.1} {h:.1} re S\n"));
    let shop_short: String = shop.chars().take(26).collect();
    let name_short: String = p.name.chars().take(24).collect();
    let code = p.barcode.as_deref().filter(|s| !s.is_empty()).unwrap_or(&p.sku);
    let price = format_minor_money(p.sell_price_minor, sym);

    stream.push_str(&format!(
        "0.4 0.4 0.45 rg BT /F1 6.5 Tf 1 0 0 1 {:.1} {:.1} Tm ({}) Tj ET\n",
        x + 8.0, y + h - 12.0, pdf_esc(&shop_short)
    ));
    stream.push_str(&format!(
        "0.1 0.1 0.12 rg BT /F2 8.5 Tf 1 0 0 1 {:.1} {:.1} Tm ({}) Tj ET\n",
        x + 8.0, y + h - 23.0, pdf_esc(&name_short)
    ));
    draw_code39(stream, code, x + 8.0, y + 25.0, w - 16.0, 32.0);
    stream.push_str(&format!(
        "0.2 0.2 0.24 rg BT /F3 7 Tf 1 0 0 1 {:.1} {:.1} Tm ({}) Tj ET\n",
        x + 8.0, y + 12.0, pdf_esc(code)
    ));
    stream.push_str(&format!(
        "0 0 0 rg BT /F2 9.5 Tf 1 0 0 1 {:.1} {:.1} Tm ({}) Tj ET\n",
        x + w - 48.0, y + 11.0, pdf_esc(&price)
    ));
}

pub fn generate_barcode_labels_pdf(
    out_dir: &Path,
    shop_name: &str,
    currency_symbol: &str,
    items: &[Product],
    stamp: &str,
) -> Result<PdfExportResult, String> {
    std::fs::create_dir_all(out_dir).map_err(|e| format!("Create PDF dir: {e}"))?;
    let mut page_streams: Vec<String> = Vec::new();
    let (margin_x, top_y, cell_w, cell_h) = (22.0f32, 814.0f32, 183.6f32, 98.0f32);

    for chunk in items.chunks(24) {
        let mut s = String::with_capacity(8192);
        for (idx, prod) in chunk.iter().enumerate() {
            let col = (idx % 3) as f32;
            let row = (idx / 3) as f32;
            let x = margin_x + col * cell_w;
            let y = top_y - (row + 1.0) * cell_h;
            draw_label_cell(&mut s, shop_name, currency_symbol, prod, x, y, cell_w, cell_h);
        }
        page_streams.push(s);
    }

    let mut objs: Vec<String> = vec![
        "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n".to_string(),
        String::new(), // placeholder for Pages object 2
        "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n".to_string(),
        "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n".to_string(),
        "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n".to_string(),
    ];
    let mut kids = Vec::new();
    for stream in &page_streams {
        let page_id = objs.len() + 1;
        let cont_id = page_id + 1;
        kids.push(format!("{page_id} 0 R"));
        objs.push(format!(
            "{page_id} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents {cont_id} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> >>\nendobj\n"
        ));
        objs.push(format!(
            "{cont_id} 0 obj\n<< /Length {} >>\nstream\n{stream}endstream\nendobj\n",
            stream.len()
        ));
    }
    objs[1] = format!(
        "2 0 obj\n<< /Type /Pages /Kids [{}] /Count {} >>\nendobj\n",
        kids.join(" "), page_streams.len()
    );

    let mut pdf = Vec::with_capacity(16384);
    pdf.extend_from_slice(b"%PDF-1.4\n");
    let mut offsets = Vec::with_capacity(objs.len());
    for obj in &objs {
        offsets.push(pdf.len());
        pdf.extend_from_slice(obj.as_bytes());
    }
    let xref_pos = pdf.len();
    pdf.extend_from_slice(format!("xref\n0 {}\n0000000000 65535 f \n", objs.len() + 1).as_bytes());
    for off in offsets {
        pdf.extend_from_slice(format!("{off:010} 00000 n \n").as_bytes());
    }
    pdf.extend_from_slice(
        format!("trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n", objs.len() + 1)
            .as_bytes(),
    );

    let file_path = out_dir.join(format!("kura-labels-{stamp}.pdf"));
    std::fs::write(&file_path, &pdf).map_err(|e| format!("Write labels PDF: {e}"))?;
    Ok(PdfExportResult {
        file_path: file_path.to_string_lossy().into_owned(),
        data_url: format!("data:application/pdf;base64,{}", STANDARD.encode(&pdf)),
        size_bytes: pdf.len(),
    })
}
