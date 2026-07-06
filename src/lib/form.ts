export function readFormValue(formData: FormData, key: string): string {
    const value = formData.get(key)

    return typeof value === 'string' ? value.trim() : ''
}

export function readOptionalFormValue(formData: FormData, key: string): string | null {
    const value = readFormValue(formData, key)

    return value.length > 0 ? value : null
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
