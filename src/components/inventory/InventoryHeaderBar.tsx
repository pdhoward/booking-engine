// /components/inventory/InventoryHeaderBar.tsx
// What: Top header bar for Inventory page. Shows active/new badges,
//       unsaved indicator, and provides New / Save actions.

"use client";

import React from "react";
import { Unit } from "@/types/unit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Save } from "lucide-react";

type Props = {
  u: Unit;
  isDirty: boolean;
  onNew: () => void;
  onSave: () => void;
};

export default function InventoryHeaderBar({ u, isDirty, onNew, onSave }: Props) {
  return (
    <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-3">
      <div className="flex items-center gap-2">
        <span className="font-semibold tracking-tight">Inventory</span>

        <Badge variant={u.active ? "default" : "secondary"} className="ml-2">
          {u.active ? "Active" : "Suspended"}
        </Badge>

        {u.name ? (
          <Badge className="ml-1 bg-blue-600 text-white">
            {u.name}
            {u.unitNumber ? ` #${u.unitNumber}` : ""}
          </Badge>
        ) : (
          <Badge className="ml-1 bg-red-600 text-white">new unit</Badge>
        )}

        {isDirty && (
          <Badge className="ml-1 border-amber-500 text-amber-700 bg-amber-50">Unsaved</Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onNew}>
          <Plus className="h-4 w-4 mr-2" />
          New
        </Button>

        <Button
          variant={isDirty ? "default" : "outline"}
          size="sm"
          onClick={onSave}
          className={isDirty ? "relative ring-2 ring-amber-400" : undefined}
        >
          {isDirty && (
            <>
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-500 animate-ping" />
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-500" />
            </>
          )}
          <Save className="h-4 w-4 mr-2" />
          {isDirty ? "Save changes" : "Save"}
        </Button>
      </div>
    </div>
  );
}
