// app/docs/page.tsx
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolink from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import { fetchGitHubFileAsText } from "@/lib/github";

export const dynamic = "force-dynamic";

const prettyCodeOptions = {
  theme: {
    dark: "github-dark",
    light: "github-light",
  },
  keepBackground: false,
};

const components = {
  // You can map MDX elements to shadcn/ui, etc. if desired.
};

async function getInstructions() {
  // primary path
  const primary = await fetchGitHubFileAsText({
    owner: "pdhoward",
    repo: "booking-engine",
    path: "Instructions.md",
    ref: "main",
  });
  if (primary) return primary;

  // common fallbacks
  const fallbacks = ["docs/Instructions.md", "INSTRUCTIONS.md", "instructions.md"];
  for (const path of fallbacks) {
    const t = await fetchGitHubFileAsText({ owner: "pdhoward", repo: "booking-engine", path });
    if (t) return t;
  }
  return null;
}

export default async function DocsPage() {
  const mdx = await getInstructions();

  if (!mdx) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border bg-background p-6">
          <h1 className="text-xl font-semibold mb-1">Documentation</h1>
          <p className="text-sm text-muted-foreground">
            Couldn’t fetch <code>Instructions.md</code> from <code>pdhoward/booking-engine</code>.
            Make sure the file exists and <code>GITHUB_TOKEN</code> is set in your server environment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <article className="prose prose-zinc dark:prose-invert max-w-none">
       
        <MDXRemote
          source={mdx}
          components={components}
          options={{
            mdxOptions: {
              remarkPlugins: [remarkGfm],
              rehypePlugins: [
                rehypeSlug,
                [rehypeAutolink, { behavior: "wrap" }],
                [rehypePrettyCode, prettyCodeOptions],
              ],
            },
          }}
        />
      </article>
    </div>
  );
}
