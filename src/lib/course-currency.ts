const COURSE_CURRENCY_CODES = [
  "AED", "AFN", "ALL", "AMD", "ANG", "AOA", "ARS", "AUD", "AWG", "AZN",
  "BAM", "BBD", "BDT", "BGN", "BHD", "BIF", "BMD", "BND", "BOB", "BRL",
  "BSD", "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHF", "CLP", "CNY",
  "COP", "CRC", "CUC", "CUP", "CVE", "CZK", "DJF", "DKK", "DOP", "DZD",
  "EGP", "ERN", "ETB", "EUR", "FJD", "FKP", "GBP", "GEL", "GHS", "GIP",
  "GMD", "GNF", "GTQ", "GYD", "HKD", "HNL", "HRK", "HTG", "HUF", "IDR",
  "ILS", "INR", "IQD", "IRR", "ISK", "JMD", "JOD", "JPY", "KES", "KGS",
  "KHR", "KMF", "KPW", "KRW", "KWD", "KYD", "KZT", "LAK", "LBP", "LKR",
  "LRD", "LSL", "LYD", "MAD", "MDL", "MGA", "MKD", "MMK", "MNT", "MOP",
  "MRU", "MUR", "MVR", "MWK", "MXN", "MYR", "MZN", "NAD", "NGN", "NIO",
  "NOK", "NPR", "NZD", "OMR", "PAB", "PEN", "PGK", "PHP", "PKR", "PLN",
  "PYG", "QAR", "RON", "RSD", "RUB", "RWF", "SAR", "SBD", "SCR", "SDG",
  "SEK", "SGD", "SHP", "SLE", "SLL", "SOS", "SRD", "SSP", "STN", "SVC",
  "SYP", "SZL", "THB", "TJS", "TMT", "TND", "TOP", "TRY", "TTD", "TWD",
  "TZS", "UAH", "UGX", "USD", "UYU", "UZS", "VES", "VND", "VUV", "WST",
  "XAF", "XCD", "XCG", "XDR", "XOF", "XPF", "XSU", "YER", "ZAR", "ZMW",
  "ZWG", "ZWL",
] as const;

export type CourseCurrency = (typeof COURSE_CURRENCY_CODES)[number];

export const COURSE_CURRENCIES = COURSE_CURRENCY_CODES.map((code) => ({
  code,
  label: code,
}));

export const DEFAULT_COURSE_CURRENCY: CourseCurrency = "INR";

const COURSE_CURRENCY_CODE_SET = new Set<string>(COURSE_CURRENCY_CODES);

export function isCourseCurrency(value: string): value is CourseCurrency {
  return COURSE_CURRENCY_CODE_SET.has(value);
}

export function formatCoursePrice(
  price: number | null | undefined,
  currency: string | null | undefined,
) {
  if (price == null) return null;
  if (price === 0) return "Free";
  const requestedCurrency = currency ?? "";
  const code: CourseCurrency = isCourseCurrency(requestedCurrency)
    ? requestedCurrency
    : DEFAULT_COURSE_CURRENCY;
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: code,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(price);
}
