import { NextResponse } from "next/server";
import { TTL, cacheGet, cacheSet, fetchJson, fetchText } from "@/lib/api-cache";
import { jmaOfficeOfPref, nearestSeaArea, seaAreaOffice } from "@/lib/jma-areas";
import {
  findFeedLink,
  parseFeed,
  parseMarineXml,
  parseWarningsXml,
  parseWeekly,
  warningMatchesArea,
  type FeedEntry,
} from "@/lib/jma";
import type { JmaMarine, JmaResponse, JmaWarning, JmaWeekly } from "@/lib/types";

export const dynamic = "force-dynamic";

const FEED_URL = "https://www.data.jma.go.jp/developer/xml/feed/other.xml";

async function loadFeed(): Promise<FeedEntry[]> {
  const key = "jma:feed";
  const cached = cacheGet<FeedEntry[]>(key);
  if (cached) return cached;
  const xml = await fetchText(FEED_URL, 15000);
  const entries = parseFeed(xml);
  if (entries.length) cacheSet(key, entries, TTL.jmaWarning);
  return entries;
}

async function loadWeekly(office: string): Promise<JmaWeekly | null> {
  const key = `jma:weekly:${office}`;
  const cached = cacheGet<JmaWeekly | null>(key);
  if (cached !== null) return cached;
  try {
    const raw = await fetchJson<unknown>(
      `https://www.jma.go.jp/bosai/forecast/data/forecast/${office}.json`,
      15000
    );
    const weekly = parseWeekly(raw);
    cacheSet(key, weekly, TTL.jmaForecast);
    return weekly;
  } catch {
    return null;
  }
}

async function loadMarine(feed: FeedEntry[], office: string, areaCode: string): Promise<JmaMarine | null> {
  const key = `jma:marine:${office}:${areaCode}`;
  const cached = cacheGet<JmaMarine | null>(key);
  if (cached !== null) return cached;
  try {
    const link = findFeedLink(feed, "予報", office);
    if (!link) return null;
    const xml = await fetchText(link, 15000);
    const marine = parseMarineXml(xml, areaCode);
    cacheSet(key, marine, TTL.jmaForecast);
    return marine;
  } catch {
    return null;
  }
}

async function loadWarnings(feed: FeedEntry[], office: string, areaCode: string): Promise<JmaWarning[]> {
  const key = `jma:warnings:${office}:${areaCode}`;
  const cached = cacheGet<JmaWarning[]>(key);
  if (cached) return cached;
  try {
    const link = findFeedLink(feed, "警報", office);
    if (!link) return [];
    const xml = await fetchText(link, 15000);
    const warnings = warningMatchesArea(parseWarningsXml(xml), areaCode);
    cacheSet(key, warnings, TTL.jmaWarning);
    return warnings;
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const pref = url.searchParams.get("pref") ?? "";
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  if (!/^\d{2}$/.test(pref) || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "pref / lat / lon が不正です" }, { status: 400 });
  }

  const office = jmaOfficeOfPref(pref);
  const area = nearestSeaArea(lat, lon);
  const seaOffice = seaAreaOffice(area.code);

  let feed: FeedEntry[] = [];
  try {
    feed = await loadFeed();
  } catch {
    feed = [];
  }

  const [weekly, marine, warnings] = await Promise.all([
    loadWeekly(office),
    feed.length ? loadMarine(feed, seaOffice, area.code) : Promise.resolve(null),
    feed.length ? loadWarnings(feed, seaOffice, area.code) : Promise.resolve([]),
  ]);

  const payload: JmaResponse = {
    weekly,
    marine,
    warnings,
    area: { seaAreaCode: area.code, seaAreaName: area.name },
  };
  return NextResponse.json(payload);
}
