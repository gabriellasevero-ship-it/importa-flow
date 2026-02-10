"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "./utils";
import { Button } from "./button";
import { Badge } from "./badge";
import { Checkbox } from "./checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover";

export interface MultiSelectOption {
  label: string;
  value: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Selecione...",
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleClear = () => {
    onChange([]);
  };

  const selectedLabels = options
    .filter((option) => selected.includes(option.value))
    .map((option) => option.label);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <span className="truncate">
            {selected.length === 0
              ? placeholder
              : selected.length === 1
              ? selectedLabels[0]
              : `${selected.length} selecionadas`}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <div className="max-h-64 overflow-auto p-2">
          {selected.length > 0 && (
            <div className="mb-2 pb-2 border-b">
              <button
                onClick={handleClear}
                className="w-full flex items-center justify-start text-sm h-8 px-2 hover:bg-muted rounded-sm"
              >
                <X className="mr-2 h-4 w-4" />
                Limpar seleção
              </button>
            </div>
          )}
          <div className="space-y-1">
            {options.map((option) => (
              <div
                key={option.value}
                className="flex items-center space-x-2 p-2 hover:bg-muted rounded-sm cursor-pointer"
                onClick={() => handleToggle(option.value)}
              >
                <Checkbox
                  id={`multi-${option.value}`}
                  checked={selected.includes(option.value)}
                  onCheckedChange={() => handleToggle(option.value)}
                />
                <label
                  htmlFor={`multi-${option.value}`}
                  className="text-sm cursor-pointer flex-1"
                >
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}