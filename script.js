/*
 * Search
 */

function searchPage() {
    const input = document.getElementById("searchInput");

    const searchTerm = input.value.toLowerCase().trim();

    if (searchTerm === "") {
        return;
    }

    const pageText = document.body.innerText.toLowerCase();

    if (pageText.includes(searchTerm)) {
        alert(
            'The term "' +
            searchTerm +
            '" was found on this page.'
        );
    } else {
        alert(
            'The term "' +
            searchTerm +
            '" was not found.'
        );
    }
}


/*
 * Diary
 */

function saveDiaryEntry() {
    const dateInput = document.getElementById("diaryDate");
    const textInput = document.getElementById("diaryText");

    const date = dateInput.value;
    const text = textInput.value.trim();

    if (date === "") {
        alert("Please select a date.");
        return;
    }

    if (text === "") {
        alert("Please write something before saving.");
        return;
    }


    const entry = {
        date: date,
        text: text
    };


    const entries = getDiaryEntries();

    entries.push(entry);


    localStorage.setItem(
        "compilerDiary",
        JSON.stringify(entries)
    );


    textInput.value = "";

    loadDiaryEntries();
}


/*
 * Get diary entries from localStorage
 */

function getDiaryEntries() {
    const storedEntries =
        localStorage.getItem("compilerDiary");

    if (storedEntries === null) {
        return [];
    }

    return JSON.parse(storedEntries);
}


/*
 * Display diary entries
 */

function loadDiaryEntries() {
    const diaryEntries =
        document.getElementById("diaryEntries");

    const entries = getDiaryEntries();


    diaryEntries.innerHTML = "";


    /*
     * Show newest entries first.
     */

    entries.reverse();


    for (const entry of entries) {

        const article =
            document.createElement("article");

        article.className = "diary-entry";


        const date =
            document.createElement("div");

        date.className = "diary-entry-date";

        date.textContent = formatDate(entry.date);


        const content =
            document.createElement("div");

        content.className = "diary-entry-content";

        content.textContent = entry.text;


        article.appendChild(date);

        article.appendChild(content);


        diaryEntries.appendChild(article);
    }
}


/*
 * Format YYYY-MM-DD into a readable date.
 */

function formatDate(date) {
    const parts = date.split("-");

    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}


/*
 * Load entries when the page starts.
 */

loadDiaryEntries();