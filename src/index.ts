import path from "node:path";
import {
	createEndpointJsonFiles,
	fetchHizbData,
	fetchJuzData,
	fetchPageData,
	fetchSurahData,
	fetchTafseerAyahsData,
	fetchTafseerAyahsDataConcurrently,
} from "./functions/data.quran.js";

const DATA_DIR = path.join(process.cwd(), "data");
const SURAH_FOLDER = "surahs";
const TAFSEER_FOLDER = "tafseers";
const JUZ_FOLDER = "juz";
const HIZB_FOLDER = "hizb";
const PAGE_FOLDER = "pages";

const main = async (tafseerConcurrent: boolean) => {
	try {
		console.time(`[DATA FETCH]`);

		console.info("Starting Surah data fetch...");
		await fetchSurahData(DATA_DIR, SURAH_FOLDER);
		console.info("Surah data fetch completed.");

		console.info("Starting Tafseer fetch...");

		tafseerConcurrent
			? await fetchTafseerAyahsDataConcurrently(
					DATA_DIR,
					SURAH_FOLDER,
					TAFSEER_FOLDER
			  )
			: await fetchTafseerAyahsData(
					DATA_DIR,
					SURAH_FOLDER,
					TAFSEER_FOLDER
			  );

		console.info("Tafseer fetch completed.");

		console.info("Starting Juz compilation...");
		await fetchJuzData(DATA_DIR, SURAH_FOLDER, JUZ_FOLDER);
		console.info("Juz compilation completed.");

		console.info("Starting Hizb compilation...");
		await fetchHizbData(DATA_DIR, SURAH_FOLDER, HIZB_FOLDER);
		console.info("Hizb compilation completed.");

		console.info("Starting Page compilation...");
		await fetchPageData(DATA_DIR, SURAH_FOLDER, PAGE_FOLDER);
		console.info("Page compilation completed.");

		console.info("Starting Endpoint Json Files compilation...");
		await createEndpointJsonFiles(DATA_DIR);
		console.info("Endpoint Json Files compilation completed.");

		console.timeEnd(`[DATA FETCH]`);
	} catch (err) {
		console.error(`[Error] - Main execution failed: ${err}`);
	}
};

main(true);
