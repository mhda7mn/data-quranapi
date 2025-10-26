import path from "node:path";
import fs from "node:fs";

export const delay = (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));

export const fetchWithRetries = async <T>(
	fn: () => Promise<T>,
	retries = 5,
	delayTime = 1000
): Promise<T | null> => {
	try {
		return await fn();
	} catch (err) {
		console.error(`[Error] - ${err}`);
		if (retries > 0) {
			console.info(`[Retrying] - ${retries} retries left`);
			await delay(delayTime);
			return fetchWithRetries(fn, retries - 1, delayTime);
		} else {
			console.error(`[Failed] - Max retries reached.`);
			return null;
		}
	}
};

interface CreateJsonInterface {
	dirname: string;
	folder: string;
	filename: string;
	data: any;
}

export const createJsonFile = async ({
	dirname,
	folder,
	filename,
	data,
}: CreateJsonInterface) => {
	const dataDir = path.join(dirname, folder);
	const filePath = path.join(dataDir, filename);

	try {
		await fs.promises.mkdir(dataDir, { recursive: true });
		await fs.promises.writeFile(
			filePath,
			JSON.stringify(data, null, 2)
		);
		console.info(`[Created JSON] - ${filename}`);
	} catch (err) {
		console.error(`[Error] - Create JSON file - ${err}`);
	}
};

interface addAyatInterface {
	ayahNo: number;
}

export const addAyatData = async ({
	dirname,
	folder,
	filename,
	ayahNo,
	data,
}: CreateJsonInterface & addAyatInterface) => {
	const dataDir = path.join(dirname, folder);
	const filePath = path.join(dataDir, filename);

	try {
		if (fs.existsSync(filePath)) {
			const existingDataFile = JSON.parse(
				await fs.promises.readFile(filePath, "utf-8")
			);

			existingDataFile.ayat.push(...data);

			await fs.promises.writeFile(
				filePath,
				JSON.stringify(existingDataFile, null, 2)
			);

			console.info(
				`[Added Ayah Data] - (Ayah: ${ayahNo}) - ${filename}`
			);
		}
	} catch (err) {
		console.error(`[Error] - Add ayat data - ${err}`);
	}
};

// Data helpers

export const getAyahInfoFromAPI = async (
	surahNumber: number,
	ayahNumber: number
) => {
	const baseAPILink = "https://quranapi.pages.dev/api";

	const response = await fetch(
		`${baseAPILink}/${surahNumber}/${ayahNumber}.json`
	);

	return response.json();
};

export const getAyahMetaDataFromAPI = async (
	surahNumber: number,
	ayahNumber: number
) => {
	const baseAPILink = "https://api.alquran.cloud/v1/ayah";

	const response = await fetch(
		`${baseAPILink}/${surahNumber}:${ayahNumber}/quran-uthmani`
	);

	return response.json();
};

export const getAyahTafseerFromAPI = async (
	surahNumber: number,
	ayahNumber: number
) => {
	const tafseerId = [1, 2, 3, 4, 6, 7, 8];

	const baseAPILink = "http://api.quran-tafseer.com/tafseer";

	let tafseer = [];

	for (let id in tafseerId) {
		const response = await fetch(
			`${baseAPILink}/${id}/${surahNumber}/${ayahNumber}`
		);

		const data: any = await response.json();

		tafseer.push({
			tafseerBookName: data.tafseer_name,
			tafseer: data.text,
		});
	}
	return tafseer;
};

export const getSurahsFromAPI = async () => {
	const baseAPILink = "https://quranapi.pages.dev/api";

	const response = await fetch(`${baseAPILink}/surah.json`);

	return response.json();
};
