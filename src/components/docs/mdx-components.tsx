// components/docs/mdx-components.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Lightweight code block (you can upgrade to shiki later)
function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="my-4 overflow-x-auto rounded-lg border bg-muted p-3 text-sm">
      {children}
    </pre>
  );
}
function Code(props: React.HTMLAttributes<HTMLElement>) {
  return (
    <code
      {...props}
      className={cn(
        "rounded bg-muted px-1 py-0.5 text-[0.9em]",
        props.className
      )}
    />
  );
}

// A handy “shortcode” you can use in MDX: <StepCard title="...">...</StepCard>
export function StepCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="my-6">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// Another shortcode: <Callout variant="default|destructive|warning|success" title="...">...</Callout>
export function Callout({
  title = "Note",
  variant,
  children,
}: {
  title?: string;
  variant?: "default" | "destructive";
  children?: React.ReactNode;
}) {
  return (
    <Alert variant={variant ?? "default"} className="my-4">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

// Map common Markdown tags to nicer shadcn-styled elements
export const mdxComponents = {
  // headings
  h1: (props: any) => (
    <h1
      {...props}
      className={cn(
        "mb-4 scroll-m-20 text-4xl font-bold tracking-tight",
        props.className
      )}
    />
  ),
  h2: (props: any) => (
    <h2
      {...props}
      className={cn(
        "mt-10 mb-4 scroll-m-20 border-b pb-1 text-2xl font-semibold tracking-tight",
        props.className
      )}
    />
  ),
  h3: (props: any) => (
    <h3
      {...props}
      className={cn("mt-8 mb-2 scroll-m-20 text-xl font-semibold", props.className)}
    />
  ),
  // text
  p: (props: any) => (
    <p {...props} className={cn("leading-7 [&:not(:first-child)]:mt-4", props.className)} />
  ),
  ul: (props: any) => (
    <ul {...props} className={cn("my-4 ml-6 list-disc space-y-1", props.className)} />
  ),
  ol: (props: any) => (
    <ol {...props} className={cn("my-4 ml-6 list-decimal space-y-1", props.className)} />
  ),
  li: (props: any) => <li {...props} className={cn("leading-7", props.className)} />,

  // rules, quotes, links, code
  hr: () => <Separator className="my-8" />,
  blockquote: (props: any) => (
    <Alert className="my-4">
      <AlertTitle>Note</AlertTitle>
      <AlertDescription>{props.children}</AlertDescription>
    </Alert>
  ),
  a: (props: any) => (
    <a
      {...props}
      className={cn(
        "font-medium underline underline-offset-4 hover:text-primary",
        props.className
      )}
      target={props.href?.startsWith("http") ? "_blank" : undefined}
      rel={props.href?.startsWith("http") ? "noopener noreferrer" : undefined}
    />
  ),
  pre: Pre,
  code: Code,

  // expose shadcn shortcodes for direct use in MDX
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  StepCard,
  Callout,
  Badge,
};
