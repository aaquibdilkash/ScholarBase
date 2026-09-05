import { stripHtmlTags } from "@/lib/html";

export function readFormValue(formData: FormData, key: string): string {
    const value = formData.get(key)

    return typeof value === 'string' ? value.trim() : ''
}

export function readOptionalFormValue(formData: FormData, key: string): string | null {
    const value = readFormValue(formData, key)

    return value.length > 0 ? value : null
}

/**
 * Throws if the rich-text field exceeds the limit (measured against visible
 * plain-text characters, not raw HTML). Defense-in-depth: never trust the
 * client to enforce the cap.
 */
export function assertRichTextWithinLimit(
    html: string,
    maxLength: number,
    fieldLabel = "Content",
): void {
    if (!maxLength || maxLength <= 0) return;
    const length = stripHtmlTags(html ?? "").length;
    if (length > maxLength) {
        throw new Error(
            `${fieldLabel} exceeds the ${maxLength}-character limit (${length} characters).`,
        );
    }
}

export function normalizeHandle(handle: string | null): string | null {
    if (!handle) {
        return null
    }

    const normalized = handle.replace(/^@+/, '').trim().toLowerCase()

    return normalized.length > 0 ? normalized : null
}

export function slugify(value: string): string {
    return value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/['"]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}
