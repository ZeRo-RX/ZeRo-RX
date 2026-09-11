/**
 * Generate the self-hosted GitHub statistics SVG for the profile README.
 * Fetches live metrics from the GitHub API and rewrites assets/stats/profile-stats.svg.
 * Also updates the cache-busting query parameter in README.md so GitHub's CDN
 * always serves the latest SVG.
 *
 * Environment variables:
 *   GITHUB_USERNAME  – GitHub login to query (default: ZeRo-RX)
 *   GITHUB_TOKEN     – Optional GH token for higher API rate limits
 *   README_PATH      – Path to README.md (default: ./README.md)
 *   SVG_PATH         – Path to profile-stats.svg (default: ./assets/stats/profile-stats.svg)
 */

const https = require("https");

const USERNAME = process.env.GITHUB_USERNAME || "ZeRo-RX";
const TOKEN = process.env.GITHUB_TOKEN;
const README_PATH = process.env.README_PATH || "./README.md";
const SVG_PATH = process.env.SVG_PATH || "./assets/stats/profile-stats.svg";

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "zero-rx-stats-generator",
};
if (TOKEN) {
  headers.Authorization = `Bearer ${TOKEN}`;
  headers["X-GitHub-Api-Version"] = "2022-11-28";
}

function ghGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            return reject(
              new Error(`GitHub API ${res.statusCode}: ${data.slice(0, 500)}`)
            );
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

/** Fetch every public repo for the user (handles pagination). */
async function fetchAllRepos() {
  const repos = [];
  let page = 1;
  const perPage = 100;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const data = await ghGet(
      `https://api.github.com/users/${USERNAME}/repos?per_page=${perPage}&page=${page}&sort=updated`
    );
    if (!Array.isArray(data) || data.length === 0) break;
    repos.push(...data);
    if (data.length < perPage) break;
    page++;
  }
  return repos;
}

function buildSvg(stats) {
  const { repos, followers, following, stars } = stats;
  const label = `ZeRo-RX GitHub statistics: ${repos} repositories, ${followers} followers, ${following} following, ${stars} stars`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  ZeRo-RX GitHub statistics card (self-hosted, no external service).
  Shows real profile metrics. Reliable because it is served from the repo itself,
  the same way the animated electronics hero is.
  Numbers reflect the public profile (repositories / followers / following / stars).
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 200" width="1200" height="200"
     role="img" aria-label="${label}">
  <defs>
    <linearGradient id="tileGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0e1d27"/>
      <stop offset="100%" stop-color="#0a151c"/>
    </linearGradient>
    <filter id="softGlow2" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <rect x="0" y="0" width="1200" height="200" rx="14" fill="#070d13" stroke="#13252f" stroke-width="1.5"/>

  <!-- tile 1: Repositories -->
  <g>
    <rect x="10" y="40" width="270" height="120" rx="12" fill="url(#tileGrad)" stroke="#1d3340"/>
    <text x="145" y="105" text-anchor="middle" font-family="'Segoe UI',Helvetica,Arial,sans-serif"
          font-size="48" font-weight="700" fill="#4dd0e1">${repos}</text>
    <text x="145" y="138" text-anchor="middle" font-family="'Segoe UI',Helvetica,Arial,sans-serif"
          font-size="15" fill="#8aa0a8" letter-spacing="1">REPOSITORIES</text>
  </g>
  <!-- tile 2: Followers -->
  <g>
    <rect x="300" y="40" width="270" height="120" rx="12" fill="url(#tileGrad)" stroke="#1d3340"/>
    <text x="435" y="105" text-anchor="middle" font-family="'Segoe UI',Helvetica,Arial,sans-serif"
          font-size="48" font-weight="700" fill="#4dd0e1">${followers}</text>
    <text x="435" y="138" text-anchor="middle" font-family="'Segoe UI',Helvetica,Arial,sans-serif"
          font-size="15" fill="#8aa0a8" letter-spacing="1">FOLLOWERS</text>
  </g>
  <!-- tile 3: Following -->
  <g>
    <rect x="590" y="40" width="270" height="120" rx="12" fill="url(#tileGrad)" stroke="#1d3340"/>
    <text x="725" y="105" text-anchor="middle" font-family="'Segoe UI',Helvetica,Arial,sans-serif"
          font-size="48" font-weight="700" fill="#4dd0e1">${following}</text>
    <text x="725" y="138" text-anchor="middle" font-family="'Segoe UI',Helvetica,Arial,sans-serif"
          font-size="15" fill="#8aa0a8" letter-spacing="1">FOLLOWING</text>
  </g>
  <!-- tile 4: Stars -->
  <g>
    <rect x="880" y="40" width="270" height="120" rx="12" fill="url(#tileGrad)" stroke="#1d3340"/>
    <text x="1015" y="105" text-anchor="middle" font-family="'Segoe UI',Helvetica,Arial,sans-serif"
          font-size="48" font-weight="700" fill="#ffce54">${stars}</text>
    <text x="1015" y="138" text-anchor="middle" font-family="'Segoe UI',Helvetica,Arial,sans-serif"
          font-size="15" fill="#8aa0a8" letter-spacing="1">STARS EARNED</text>
  </g>

  <text x="600" y="22" text-anchor="middle" font-family="'Segoe UI',Helvetica,Arial,sans-serif"
        font-size="14" fill="#5f7a86" letter-spacing="2">GITHUB STATISTICS</text>
</svg>`;
}

const fs = require("fs");
const path = require("path");

async function main() {
  console.log(`Fetching GitHub stats for ${USERNAME}...`);

  const [user, repos] = await Promise.all([
    ghGet(`https://api.github.com/users/${USERNAME}`),
    fetchAllRepos(),
  ]);

  const stats = {
    repos: repos.length,
    followers: user.followers,
    following: user.following,
    stars: repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0),
  };

  console.log("Stats:", stats);

  const svg = buildSvg(stats);
  const svgPath = path.resolve(SVG_PATH);
  fs.mkdirSync(path.dirname(svgPath), { recursive: true });
  fs.writeFileSync(svgPath, svg + "\n", "utf8");
  console.log(`Wrote ${svgPath}`);

  const versionKey = `${stats.repos}-${stats.followers}-${stats.following}-${stats.stars}`;
  const readmePath = path.resolve(README_PATH);
  let readme = fs.readFileSync(readmePath, "utf8");
  const before = readme;
  readme = readme.replace(
    /profile-stats\.svg(?:\?v=[^")\s]*)?/g,
    `profile-stats.svg?v=${versionKey}`
  );
  if (readme !== before) {
    fs.writeFileSync(readmePath, readme, "utf8");
    console.log(`Updated cache-busting param in README -> ?v=${versionKey}`);
  } else {
    console.log("README image URL already up to date.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
