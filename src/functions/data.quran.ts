import path from "node:path";
import fs from "node:fs";
import pLimit from "p-limit";
import {
	addAyatData,
	createJsonFile,
	delay,
	fetchWithRetries,
	getAyahInfoFromAPI,
	getAyahMetaDataFromAPI,
	getAyahTafseerFromAPI,
	getSurahsFromAPI,
} from "./helpers.js";

interface processAyahInterface {
	dirname: string;
	folder: string;
	surahNumber: number;
	surah: {
		surahNameArabic: string;
		surahNameArabicLong: string;
		surahName: string;
		revelationPlace: string;
		totalAyah: number;
	};
}

const processAyahData = async ({
	dirname,
	folder,
	surahNumber,
	surah,
}: processAyahInterface) => {
	const surahData = {
		surahNo: surahNumber,
		surahNameAr: surah.surahNameArabic,
		surahNameArabicLong: surah.surahNameArabicLong,
		surahNameEn: surah.surahName,
		revelationPlace: surah.revelationPlace,
		totalAyat: surah.totalAyah,
		ayat: [],
	};

	const filename = `${surahNumber}.json`;

	await createJsonFile({
		dirname,
		folder,
		filename,
		data: surahData,
	});

	for (let ayahIndex = 1; ayahIndex <= surah.totalAyah; ayahIndex++) {
		const ayahInfo: any = await fetchWithRetries(() =>
			getAyahInfoFromAPI(surahNumber, ayahIndex)
		);
		const ayahMetaData: any = await fetchWithRetries(() =>
			getAyahMetaDataFromAPI(surahNumber, ayahIndex)
		);
		await delay(100);

		const hizbNo = Math.ceil(ayahMetaData.data.hizbQuarter / 4);

		const ayahData = {
			ayahNo: ayahInfo.ayahNo,
			ayahArV1: ayahInfo.arabic1,
			ayahArV2: ayahInfo.arabic2,
			ayahEn: ayahInfo.english,
			meta: {
				page: ayahMetaData.data.page,
				juz: ayahMetaData.data.juz,
				hizb: hizbNo,
				hizbQuarter: ayahMetaData.data.hizbQuarter,
				sajda: ayahMetaData.data.sajda,
			},
		};

		await addAyatData({
			dirname,
			folder,
			filename,
			ayahNo: ayahInfo.ayahNo,
			data: [ayahData],
		});
	}
};

export const fetchSurahData = async (
	dirname: string,
	folder: string,
	retries = 5,
	delayTime = 1000
) => {
	try {
		const data: any = await getSurahsFromAPI();

		for (let index = 0; index < data.length; index++) {
			const surah = data[index];
			const surahNumber = index + 1;
			await fetchWithRetries(
				() =>
					processAyahData({ dirname, folder, surah, surahNumber }),
				retries,
				delayTime
			);

			await delay(100);
		}
	} catch (err) {
		console.error(`[Error] - Fetching surah data - ${err}`);
	}
};

export const fetchTafseerAyahsData = async (
	dirname: string,
	surahFolder: string,
	tafseerFolder: string
) => {
	const surahDir = path.join(dirname, surahFolder);
	const tafseerDir = path.join(dirname, tafseerFolder);

	await fs.promises.mkdir(tafseerDir, { recursive: true });

	let files: any = fs.promises.readdir(surahDir);

	files = (await files).sort((a: any, b: any) => {
		const numA = parseInt(a.split(".json")[0]);
		const numB = parseInt(b.split(".json")[0]);
		return numA - numB;
	});

	for (const file of files) {
		if (!file.endsWith(".json")) continue;

		const filePath = path.join(surahDir, file);
		const surahData = JSON.parse(
			await fs.promises.readFile(filePath, "utf-8")
		);
		const surahNumber = surahData.surahNo;

		const tafseerData: Record<number, any[]> = {};

		console.info(`[Processing Tafseer] - Surah ${surahNumber}`);

		for (const ayah of surahData.ayat) {
			try {
				const tafseers = await getAyahTafseerFromAPI(
					surahNumber,
					ayah.ayahNo
				);
				tafseerData[ayah.ayahNo] = tafseers;

				await delay(50);
			} catch (err) {
				console.error(
					`[Error] -  Tafseer Surah ${surahNumber}, Ayah ${ayah.ayahNo} - ${err}`
				);
			}
		}

		const tafseerFilePath = path.join(
			tafseerDir,
			`${surahNumber}.json`
		);
		await fs.promises.writeFile(
			tafseerFilePath,
			JSON.stringify(tafseerData, null, 2)
		);

		console.info(`[Tafseer Created] Surah ${surahNumber}`);
	}
	console.info(`[All Tafseer Processed]`);
};

export const fetchTafseerAyahsDataConcurrently = async (
	dirname: string,
	surahFolder: string,
	tafseerFolder: string
) => {
	const surahDir = path.join(dirname, surahFolder);
	const tafseerDir = path.join(dirname, tafseerFolder);

	await fs.promises.mkdir(tafseerDir, { recursive: true });

	let files: any = await fs.promises.readdir(surahDir);

	files = files
		.filter((f: string) => f.endsWith(".json"))
		.sort((a: any, b: any) => {
			const numA = parseInt(a.split(".json")[0]);
			const numB = parseInt(b.split(".json")[0]);
			return numA - numB;
		});

	const limit = pLimit(5); // fetch 5 ayahs concurrently

	for (const file of files) {
		const filePath = path.join(surahDir, file);
		const surahData = JSON.parse(
			await fs.promises.readFile(filePath, "utf-8")
		);
		const surahNumber = surahData.surahNo;

		const tafseerData: {
			surah: {
				surahNo: number;
				surahNameAr: string;
				surahNameArabicLong: string;
				surahNameEn: string;
				revelationPlace: string;
				totalAyat: number;
			};
			ayat: Record<number, any[]>;
		} = {
			surah: {
				surahNo: surahNumber,
				surahNameAr: surahData.surahNameAr,
				surahNameArabicLong: surahData.surahNameArabicLong,
				surahNameEn: surahData.surahNameEn,
				revelationPlace: surahData.revelationPlace,
				totalAyat: surahData.totalAyat,
			},
			ayat: {},
		};

		console.info(`[Processing Tafseer] - Surah ${surahNumber}`);

		const tafseerPromises = surahData.ayat.map((ayah: any) =>
			limit(async () => {
				try {
					const tafseers = await getAyahTafseerFromAPI(
						surahNumber,
						ayah.ayahNo
					);
					console.info(
						`[Success] - Tafseer ${surahNumber}:${ayah.ayahNo}`
					);
					tafseerData.ayat[ayah.ayahNo] = tafseers;
				} catch (err) {
					console.error(
						`[Error] - Tafseer Surah ${surahNumber}, Ayah ${ayah.ayahNo} - ${err}`
					);
				}
			})
		);

		await Promise.all(tafseerPromises);

		const tafseerFilePath = path.join(
			tafseerDir,
			`${surahNumber}.json`
		);
		await fs.promises.writeFile(
			tafseerFilePath,
			JSON.stringify(tafseerData, null, 2)
		);

		console.info(`[Tafseer Created] Surah ${surahNumber}`);
	}

	console.info(`[All Tafseer Processed]`);
};

const fetchGroupedData = async (
	dirname: string,
	surahFolder: string,
	outFolder: string,
	key: "juz" | "hizb" | "page"
) => {
	const surahDir = path.join(dirname, surahFolder);
	const folderDir = path.join(dirname, outFolder);
	await fs.promises.mkdir(folderDir, { recursive: true });

	const files: string[] = (await fs.promises.readdir(surahDir)).sort(
		(a, b) => parseInt(a) - parseInt(b)
	);

	const map: Record<number, any[]> = {};

	for (const file of files) {
		if (!file.endsWith(".json")) continue;

		const filePath = path.join(surahDir, file);
		let surahData: any;
		try {
			surahData = JSON.parse(
				await fs.promises.readFile(filePath, "utf-8")
			);
		} catch (err) {
			console.error(`[Error] Reading Surah File ${file}: ${err}`);
			continue;
		}

		for (const ayah of surahData.ayat) {
			const groupNo = ayah.meta[key];
			if (!map[groupNo]) map[groupNo] = [];
			map[groupNo].push({
				surahNo: surahData.surahNo,
				ayahNo: ayah.ayahNo,
				ayahArV1: ayah.ayahArV1,
				ayahArV2: ayah.ayahArV2,
				ayahEn: ayah.ayahEn,
				meta: ayah.meta,
			});
		}
	}

	for (const [groupNo, ayahs] of Object.entries(map)) {
		const filePath = path.join(folderDir, `${groupNo}.json`);
		await fs.promises.writeFile(
			filePath,
			JSON.stringify(ayahs, null, 2)
		);
		console.info(
			`[${key.toUpperCase()} Created] - ${key} ${groupNo}`
		);
	}

	console.info(`[All ${key.toUpperCase()} Processed]`);
};

export const fetchJuzData = (
	dirname: string,
	surahFolder: string,
	juzFolder: string
) => fetchGroupedData(dirname, surahFolder, juzFolder, "juz");

export const fetchHizbData = (
	dirname: string,
	surahFolder: string,
	hizbFolder: string
) => fetchGroupedData(dirname, surahFolder, hizbFolder, "hizb");

export const fetchPageData = (
	dirname: string,
	surahFolder: string,
	pageFolder: string
) => fetchGroupedData(dirname, surahFolder, pageFolder, "page");

export const createEndpointJsonFiles = async (dirname: string) => {
	// All Surahs
	const surahDir = path.join(dirname, "surahs");
	const surahFiles = (await fs.promises.readdir(surahDir)).filter(
		(f) => f.endsWith(".json")
	);
	const allSurahs = [];

	for (const file of surahFiles) {
		const data = JSON.parse(
			await fs.promises.readFile(path.join(surahDir, file), "utf-8")
		);
		allSurahs.push(data);
	}

	allSurahs.sort((a, b) => a.surahNo - b.surahNo);

	await fs.promises.writeFile(
		path.join(dirname, "surah.json"),
		JSON.stringify(allSurahs, null, 2)
	);

	// 2. All Juz
	const juzDir = path.join(dirname, "juz");
	const juzFiles: any = (await fs.promises.readdir(juzDir)).filter(
		(f) => f.endsWith(".json")
	);
	const allJuz: Record<number, any[]> = {};
	for (const file of juzFiles) {
		const data = JSON.parse(
			await fs.promises.readFile(path.join(juzDir, file), "utf-8")
		);
		allJuz[parseInt(file.split(".json")[0])] = data;
	}
	await fs.promises.writeFile(
		path.join(dirname, "juz.json"),
		JSON.stringify(allJuz, null, 2)
	);

	// 3. All Hizb
	const hizbDir = path.join(dirname, "hizb");
	const hizbFiles: any = (await fs.promises.readdir(hizbDir)).filter(
		(f) => f.endsWith(".json")
	);
	const allHizb: Record<number, any[]> = {};
	for (const file of hizbFiles) {
		const data = JSON.parse(
			await fs.promises.readFile(path.join(hizbDir, file), "utf-8")
		);
		allHizb[parseInt(file.split(".json")[0])] = data;
	}
	await fs.promises.writeFile(
		path.join(dirname, "hizb.json"),
		JSON.stringify(allHizb, null, 2)
	);

	// 4. All Pages
	const pageDir = path.join(dirname, "pages");
	const pageFiles: any = (await fs.promises.readdir(pageDir)).filter(
		(f) => f.endsWith(".json")
	);
	const allPages: Record<number, any[]> = {};
	for (const file of pageFiles) {
		const data = JSON.parse(
			await fs.promises.readFile(path.join(pageDir, file), "utf-8")
		);
		allPages[parseInt(file.split(".json")[0])] = data;
	}
	await fs.promises.writeFile(
		path.join(dirname, "pages.json"),
		JSON.stringify(allPages, null, 2)
	);

	console.info(
		"[Endpoint JSONs Created] - surah.json, juz.json, hizb.json, pages.json"
	);
};
