"use client";

import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useState } from "react";

import { InfoTooltip } from "@/components/ui/InfoTooltip";

type SharedProps = {
  label: string;
  tip: string;
  maxLength: number;
  id: string;
  name: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
};

type InputProps = SharedProps & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "name" | "value" | "defaultValue" | "maxLength" | "onChange"> & { as?: "input" };
type TextareaProps = SharedProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "name" | "value" | "defaultValue" | "maxLength" | "onChange"> & { as: "textarea" };

export function TextField(props: InputProps | TextareaProps) {
  const { label, tip, maxLength, id, name, defaultValue = "", value, onValueChange, as = "input", ...fieldProps } = props;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const currentValue = value ?? uncontrolledValue;
  const handleChange = (nextValue: string) => {
    if (value === undefined) setUncontrolledValue(nextValue);
    onValueChange?.(nextValue);
  };

  return (
    <div>
      <label htmlFor={id} className="sb-label inline-flex items-center gap-1.5">
        {label}
        <InfoTooltip message={tip} />
      </label>
      {as === "textarea" ? (
        <textarea
          {...(fieldProps as Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "name" | "value" | "defaultValue" | "maxLength" | "onChange">)}
          id={id}
          name={name}
          value={value}
          defaultValue={value === undefined ? defaultValue : undefined}
          maxLength={maxLength}
          onChange={(event) => handleChange(event.target.value)}
        />
      ) : (
        <input
          {...(fieldProps as Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "name" | "value" | "defaultValue" | "maxLength" | "onChange">)}
          id={id}
          name={name}
          value={value}
          defaultValue={value === undefined ? defaultValue : undefined}
          maxLength={maxLength}
          onChange={(event) => handleChange(event.target.value)}
        />
      )}
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {currentValue.length}/{maxLength} characters
      </div>
    </div>
  );
}
