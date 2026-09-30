# Sitecore Content SDK Next.js Sample Application

## Overview

This is the basic Next.js (App Router) starter with minimal XM Cloud integration.

## How to Run This Starter Locally

Follow the [root README — How to Run a Next.js Starter Locally](../../README.md#how-to-run-a-nextjs-starter-locally), using this path: **`examples/basic-nextjs`**.

Optional: for stable absolute URLs in server-rendered code when the request has no `Host` header, set `NEXT_PUBLIC_SITE_URL` or `NEXT_PUBLIC_BASE_URL` (see [`.env.remote.example`](.env.remote.example)).

From the repo root:

```bash
cd examples/basic-nextjs
npm install
npm run dev
```

Open **http://localhost:3000**.

## Content Serialization

Dependencies:

```bash
cd ./
dotnet new tool-manifest
dotnet nuget add source -n Sitecore https://nuget.sitecore.com/resources/v3/index.json
dotnet tool install Sitecore.CLI
dotnet sitecore plugin init --overwrite
dotnet sitecore plugin list
dotnet sitecore plugin add Sitecore.DevEx.Extensibility.XMCloud
```

Serialization:

```bash
cd ./
dotnet sitecore cloud login
dotnet sitecore cloud environment connect --environment-id 7H4qTnTJFjXa1kR8522o90 --allow-write
dotnet sitecore ser validate --fix -i FmcCustomDemo.Project -n sodexo
dotnet sitecore ser pull -i FmcCustomDemo.Project -n sodexo
dotnet sitecore ser validate --fix -i FmcCustomDemo.Content -n sodexo
dotnet sitecore ser pull -i FmcCustomDemo.Content -n sodexo
```

## Documentation

- [Skills: capability map for this starter](Skills.md) — High-level capability groupings; see also the repo [docs/Skills.md](../../docs/Skills.md).
- [Sitecore Content SDK for XM Cloud](https://doc.sitecore.com/xmc/en/developers/content-sdk/sitecore-content-sdk-for-xm-cloud.html)
