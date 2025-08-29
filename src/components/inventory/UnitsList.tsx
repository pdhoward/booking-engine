// /components/inventory/UnitsList.tsx
// What: Left sidebar list of units with a refresh option.

"use client";

import React from "react";
import { Unit } from "@/types/unit";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Database, ChevronDown } from "lucide-react";

type Props = {
  units: Unit[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
};

export default function UnitsList({
  units, loading, selectedId, onSelect, onRefresh
}: Props) {
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">Existing Units</div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 text-xs">
              <Database className="h-4 w-4" /> Options <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRefresh}>Refresh</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="max-h-[60vh] overflow-y-auto space-y-1 pr-1">
        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!loading && units.length === 0 && (
          <div className="text-sm text-muted-foreground">No units yet</div>
        )}

        {units.map((it) => (
          <button
            key={String(it._id)}
            onClick={() => onSelect(String(it._id))}
            className={`w-full text-left rounded px-2 py-1 text-sm hover:bg-muted ${
              selectedId === it._id ? "bg-muted" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="truncate">
                {it.name}
                {it.unitNumber ? ` #${it.unitNumber}` : ""}
              </span>
              <span className="text-xs text-muted-foreground">
                {it.type.replace("_", " ")}
              </span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
