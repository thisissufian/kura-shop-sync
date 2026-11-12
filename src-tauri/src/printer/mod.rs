pub mod escpos;
pub mod pdf_gen;

pub fn ascii_currency(symbol: &str) -> &str {
    match symbol {
        "৳" => "Tk ",
        "€" => "EUR ",
        "₹" => "Rs.",
        "¥" => "JPY ",
        other if other.is_ascii() => other,
        _ => "$",
    }
}

pub fn format_minor_money(minor: i64, symbol: &str) -> String {
    let sym = ascii_currency(symbol);
    let neg = minor < 0;
    let abs = minor.unsigned_abs();
    let whole = abs / 100;
    let frac = abs % 100;
    if neg {
        format!("-{sym}{whole}.{frac:02}")
    } else {
        format!("{sym}{whole}.{frac:02}")
    }
}
