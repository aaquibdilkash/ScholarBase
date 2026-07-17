export function clsx(...inputs: Array<string | false | null | undefined>) {
    return inputs.filter(Boolean).join(" ");
}

