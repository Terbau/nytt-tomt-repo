import type { LookupResult, RawWatchlistItem, WatchlistItems } from "./types";
import { convertMovie, convertSeries, parseDate } from "./utils";
import fs from "fs";

export async function getItemsByIds(ids: string[]): Promise<LookupResult> {
	if (ids.length === 0) {
		return {};
	}

	const response = await fetch(
		`https://www.imdb.com/title/data?ids=${ids.join(",")}`,
		{
			headers: {
				"Accept-Language": "en-US",
			},
		},
	);
	// biome-ignore lint/complexity/noBannedTypes: <explanation>
	const data: Object = await response.json();

	const newItems: LookupResult = {};
	for (const obj of Object.values(data)) {
		if (obj.title.type === "featureFilm") {
			const movie = convertMovie(obj);
			newItems[movie.id] = movie;
		} else if (obj.title.type === "series") {
			const series = convertSeries(obj);
			newItems[series.id] = series;
		}
	}

	return newItems;
}

export async function getRawWatchlistByUserId(
	userId: string,
): Promise<RawWatchlistItem[]> {
	const response = await fetch(`https://www.imdb.com/user/${userId}/watchlist`);

	const rawText = await response.text();
  fs.writeFileSync('watchlist.html', rawText);

  const matches = rawText.match(/edges":(.*),"__typename":"TitleListItemSearchConnection"/);
	if (!matches) {
		throw new Error("Unable to parse watchlist");
	}

	const data = JSON.parse(matches[1]);
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	return data.map((item: any, index: number) => ({
		imdbItemId: item.listItem.id,
		id: item.listItem.id,
    title: item.listItem.originalTitleText.text,
    image: item.listItem.primaryImage.url,
		description: item.listItem.plot.plotText.plainText,
		addedAt: new Date(),
    position: index + 1,
    rating: item.listItem.ratingsSummary.aggregateRating,
	}));
}

export async function getWatchlistByUserId(
	userId: string,
): Promise<WatchlistItems> {
	const data = await getRawWatchlistByUserId(userId);
	const ids = data.map((item: RawWatchlistItem) => item.imdbItemId);
	const items = await getItemsByIds(ids);

	const lookup: { [id: string]: RawWatchlistItem } = {};
	for (const item of data) {
		lookup[item.imdbItemId] = item;
	}

	const newItems: WatchlistItems = {};
	for (const item of data) {
		newItems[item.id] = {
			...item,
			item: items[item.imdbItemId],
		};
	}

	return newItems;
}
