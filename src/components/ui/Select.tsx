"use client";

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ChangeEventHandler,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";

type SelectOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

type SelectProps = Omit<HTMLAttributes<HTMLDivElement>, "onChange"> & {
  name?: string;
  value?: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  onChange?: ChangeEventHandler<HTMLSelectElement>;
  children: ReactNode;
};

function getOptions(children: ReactNode): SelectOption[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child) || child.type !== "option") return [];
    const props = child.props as {
      value?: string | number;
      disabled?: boolean;
      children?: ReactNode;
    };
    return [
      {
        value: String(props.value ?? ""),
        label: props.children,
        disabled: props.disabled,
      },
    ];
  });
}

export function Select({
  name,
  value,
  defaultValue,
  required,
  disabled,
  onChange,
  children,
  className = "",
  id,
  "aria-label": ariaLabel,
  ...rest
}: SelectProps) {
  const options = getOptions(children);
  const initialValue = value ?? defaultValue ?? options[0]?.value ?? "";
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(initialValue);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();
  const selectedValue = value ?? internalValue;
  const selectedOption =
    options.find((option) => option.value === selectedValue) ?? options[0];
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === selectedValue),
  );
  const rootClassName = className
    .replace(/\bsb-(?:input|select)\b/g, "")
    .trim();

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  useEffect(() => {
    if (value !== undefined) setInternalValue(value);
  }, [value]);

  function emitChange(nextValue: string) {
    if (value === undefined) setInternalValue(nextValue);
    const event = {
      target: { value: nextValue, name } as HTMLSelectElement,
      currentTarget: { value: nextValue, name } as HTMLSelectElement,
    } as ChangeEvent<HTMLSelectElement>;
    onChange?.(event);
  }

  function choose(option: SelectOption) {
    if (option.disabled) return;
    emitChange(option.value);
    setOpen(false);
  }

  function moveSelection(direction: 1 | -1) {
    const nextIndex =
      (selectedIndex + direction + options.length) % options.length;
    const nextOption = options[nextIndex];
    if (nextOption) choose(nextOption);
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      else moveSelection(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen((current) => !current);
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Home" && open) {
      event.preventDefault();
      choose(options[0]);
    } else if (event.key === "End" && open) {
      event.preventDefault();
      choose(options[options.length - 1]);
    }
  }

  return (
    <div
      {...rest}
      ref={rootRef}
      className={`relative ${rootClassName}`}
      data-select-root=""
    >
      <select
        id={id}
        name={name}
        value={selectedValue}
        required={required}
        onChange={(event) => emitChange(event.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        ref={triggerRef}
        type="button"
        className={`sb-select-trigger ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className={!selectedOption?.value ? "text-slate-400" : ""}>
          {selectedOption?.label}
        </span>
        <span className="sb-select-chevron" aria-hidden="true">
          ⌄
        </span>
      </button>
      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className="sb-select-menu"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === selectedValue}
              aria-disabled={option.disabled}
              disabled={option.disabled}
              className="sb-select-option"
              onClick={() => choose(option)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
