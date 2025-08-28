// lib/github.ts
export async function fetchGitHubFileAsText(
  {
    owner,
    repo,
    path,
    ref = "main",
  }: { owner: string; repo: string; path: string; ref?: string }
): Promise<string | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GitHub fetch failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { content?: string; encoding?: string; download_url?: string };
  if (json.content && json.encoding === "base64") {
    return Buffer.from(json.content, "base64").toString("utf-8");
  }

  // Fallback: if API gives a download_url, fetch raw
  if (json.download_url) {
    const raw = await fetch(json.download_url, {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
      cache: "no-store",
    });
    if (!raw.ok) throw new Error("Failed to fetch raw content");
    return await raw.text();
  }

  return null;
}
