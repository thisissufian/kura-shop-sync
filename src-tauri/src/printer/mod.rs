pub mod escpos;
pub mod pdf_gen;

pub fn format_minor_money(minor: i64, symbol: &str) -> String {
    let neg = minor < 0;
    let abs = minor.unsigned_abs();
    let whole = abs / 100;
    let frac = abs % 100;
    if neg {
        format!("-{symbol}{whole}.{frac:02}")
    } else {
        format!("{symbol}{whole}.{frac:02}")
    }
}
