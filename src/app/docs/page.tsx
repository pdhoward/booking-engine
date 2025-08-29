// app/docs/page.tsx
import React from "react";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeExternalLinks from "rehype-external-links";
import { fetchPrivateGithubFileRaw } from "@/lib/github";
import { mdxComponents } from "@/components/docs/mdx-components";

export default async function DocsPage() {
  const source = await fetchPrivateGithubFileRaw({
    owner: "pdhoward",
    repo: "booking-engine",
    path: "Instructions.mdx", 
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4">
          <h1 className="text-sm font-semibold tracking-tight">Documentation</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* prose for typography defaults, but MDX components override key blocks */}
        <article className="prose prose-zinc max-w-none dark:prose-invert">
          <MDXRemote
            source={source}
            components={mdxComponents}
            options={{
              mdxOptions: {
                remarkPlugins: [remarkGfm],
                rehypePlugins: [
                  rehypeSlug,
                  [rehypeAutolinkHeadings, { behavior: "wrap" }],
                  [rehypeExternalLinks, { target: "_blank", rel: ["noopener", "noreferrer"] }],
                ],
              },
            }}
          />
        </article>
      </main>
    </div>
  );
}
