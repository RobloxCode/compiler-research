"use strict";

/* ===============================================================
 * Compiler components
 *
 * Single source of truth. The sidebar status list and the table in
 * the Compiler section are both rendered from this array, so there
 * is only one place to update when something changes.
 * ============================================================= */

const COMPONENTS = [
    {
        name: "Lexer",
        description: "Converts source code into tokens.",
        status: "Complete"
    },
    {
        name: "Parser",
        description: "Builds the syntactic structure.",
        status: "In progress"
    },
    {
        name: "Semantic analysis",
        description: "Checks semantic rules and types.",
        status: "Planned"
    },
    {
        name: "Intermediate representation",
        description: "Internal representation of the program.",
        status: "Planned"
    },
    {
        name: "Optimizer",
        description: "Applies optimization transformations.",
        status: "Planned"
    },
    {
        name: "Code generation",
        description: "Generates target code.",
        status: "Planned"
    }
];


function statusClass(status) {
    return "status-" + status.toLowerCase().replace(/\s+/g, "-");
}


function renderComponents() {
    const tbody = document.querySelector("#componentTable tbody");

    if (tbody) {
        tbody.textContent = "";

        for (const component of COMPONENTS) {
            const row = document.createElement("tr");

            const name = document.createElement("td");
            name.textContent = component.name;

            const description = document.createElement("td");
            description.textContent = component.description;

            const status = document.createElement("td");
            status.textContent = component.status;
            status.className = statusClass(component.status);

            row.append(name, description, status);
            tbody.appendChild(row);
        }
    }

    const list = document.getElementById("componentStatus");

    if (list) {
        list.textContent = "";

        for (const component of COMPONENTS) {
            const item = document.createElement("li");

            const name = document.createElement("span");
            name.textContent = component.name;

            const status = document.createElement("strong");
            status.textContent = component.status;
            status.className = statusClass(component.status);

            item.append(name, status);
            list.appendChild(item);
        }
    }
}


/* ===============================================================
 * Diary storage
 *
 * localStorage is a cache here, not the archive. Export regularly
 * and keep the exported files in the repository.
 * ============================================================= */

const DIARY_KEY = "compilerDiary";

let editingId = null;


function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }

    return "e" + Date.now() + "-" + Math.random().toString(16).slice(2);
}


function normalizeEntry(raw) {
    return {
        id: typeof raw.id === "string" && raw.id ? raw.id : makeId(),
        date: raw.date,
        text: raw.text,
        createdAt:
            typeof raw.createdAt === "string" && raw.createdAt
                ? raw.createdAt
                : new Date().toISOString()
    };
}


function isValidEntry(raw) {
    return (
        raw !== null &&
        typeof raw === "object" &&
        typeof raw.date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(raw.date) &&
        typeof raw.text === "string" &&
        raw.text.trim() !== ""
    );
}


function readDiary() {
    let raw = null;

    try {
        raw = localStorage.getItem(DIARY_KEY);
    } catch (error) {
        console.error("localStorage is not available:", error);
        return [];
    }

    if (raw === null || raw === "") {
        return [];
    }

    let parsed = null;

    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        console.error("Stored diary data is not valid JSON:", error);

        /*
         * Keep the unreadable data instead of overwriting it, so it
         * can still be recovered by hand from the browser console.
         */
        try {
            localStorage.setItem(DIARY_KEY + ".broken", raw);
        } catch (ignored) {
            /* nothing else to do */
        }

        return [];
    }

    if (!Array.isArray(parsed)) {
        console.error("Stored diary data is not an array.");
        return [];
    }

    /*
     * Entries written by the first version of this page have no id.
     * normalizeEntry() invents one, and it would invent a different
     * one on every read, so the id captured by an Edit or Delete
     * button would never match the entry found a moment later.
     * Give those entries a permanent id and write them back once.
     */

    let needsMigration = false;

    const entries = parsed.filter(isValidEntry).map(function (item) {
        const hasId = typeof item.id === "string" && item.id !== "";

        const hasCreatedAt =
            typeof item.createdAt === "string" && item.createdAt !== "";

        if (!hasId || !hasCreatedAt) {
            needsMigration = true;
        }

        return normalizeEntry(item);
    });

    if (needsMigration) {
        try {
            /*
             * Keep one copy of the original data before rewriting it.
             */
            if (localStorage.getItem(DIARY_KEY + ".backup") === null) {
                localStorage.setItem(DIARY_KEY + ".backup", raw);
            }

            localStorage.setItem(DIARY_KEY, JSON.stringify(entries));
        } catch (error) {
            console.error("Could not upgrade the stored entries:", error);
        }
    }

    return entries;
}


function writeDiary(entries) {
    try {
        localStorage.setItem(DIARY_KEY, JSON.stringify(entries));
        return true;
    } catch (error) {
        console.error("Could not save the diary:", error);

        setDiaryStatus(
            "The entry could not be saved. Storage is full or " +
            "blocked in this browser. Export your entries before " +
            "reloading the page.",
            true
        );

        return false;
    }
}


/*
 * Newest first, by the date written on the entry. An entry that is
 * backdated lands in the right place instead of at the top.
 */

function sortEntries(entries) {
    return entries.slice().sort(function (a, b) {
        if (a.date !== b.date) {
            return a.date < b.date ? 1 : -1;
        }

        if (a.createdAt !== b.createdAt) {
            return a.createdAt < b.createdAt ? 1 : -1;
        }

        return 0;
    });
}


/* ===============================================================
 * Diary editing
 * ============================================================= */

function setDiaryStatus(message, isError) {
    const status = document.getElementById("diaryStatus");

    if (!status) {
        return;
    }

    status.textContent = message;
    status.classList.toggle("is-error", isError === true);
}


function saveDiaryEntry() {
    const dateInput = document.getElementById("diaryDate");
    const textInput = document.getElementById("diaryText");

    const date = dateInput.value;
    const text = textInput.value.trim();

    if (date === "") {
        setDiaryStatus("Choose a date for this entry.", true);
        dateInput.focus();
        return;
    }

    if (text === "") {
        setDiaryStatus("Write something before saving.", true);
        textInput.focus();
        return;
    }

    const entries = readDiary();

    if (editingId !== null) {
        const existing = entries.find(function (entry) {
            return entry.id === editingId;
        });

        if (existing) {
            existing.date = date;
            existing.text = text;
        } else {
            entries.push(normalizeEntry({ date: date, text: text }));
        }
    } else {
        entries.push(normalizeEntry({ date: date, text: text }));
    }

    const saved = writeDiary(entries);

    if (!saved) {
        return;
    }

    setDiaryStatus(
        editingId !== null ? "Entry updated." : "Entry saved.",
        false
    );

    resetEditor();
    loadDiaryEntries();
}


function startEditing(id) {
    const entry = readDiary().find(function (item) {
        return item.id === id;
    });

    if (!entry) {
        setDiaryStatus(
            "That entry is no longer in storage. Reload the page.",
            true
        );

        loadDiaryEntries();
        return;
    }

    editingId = id;

    document.getElementById("diaryDate").value = entry.date;
    document.getElementById("diaryText").value = entry.text;

    document.getElementById("diarySaveButton").textContent = "Update entry";
    document.getElementById("diaryCancelButton").hidden = false;

    setDiaryStatus("Editing the entry from " + formatDate(entry.date) + ".", false);

    document.querySelector(".diary-editor").scrollIntoView({ block: "center" });
    document.getElementById("diaryText").focus();
}


function resetEditor() {
    editingId = null;

    document.getElementById("diaryText").value = "";
    document.getElementById("diarySaveButton").textContent = "Save entry";
    document.getElementById("diaryCancelButton").hidden = true;
}


function cancelEditing() {
    resetEditor();
    setDiaryStatus("Editing cancelled.", false);
}


function deleteDiaryEntry(id) {
    const entries = readDiary();

    const entry = entries.find(function (item) {
        return item.id === id;
    });

    if (!entry) {
        setDiaryStatus(
            "That entry is no longer in storage. Reload the page.",
            true
        );

        loadDiaryEntries();
        return;
    }

    const confirmed = window.confirm(
        "Delete the entry from " + formatDate(entry.date) + "? " +
        "This cannot be undone."
    );

    if (!confirmed) {
        return;
    }

    const remaining = entries.filter(function (item) {
        return item.id !== id;
    });

    if (!writeDiary(remaining)) {
        return;
    }

    if (editingId === id) {
        resetEditor();
    }

    setDiaryStatus("Entry deleted.", false);
    loadDiaryEntries();
}


/* ===============================================================
 * Diary rendering
 * ============================================================= */

function loadDiaryEntries() {
    const container = document.getElementById("diaryEntries");

    if (!container) {
        return;
    }

    container.textContent = "";

    const entries = sortEntries(readDiary());

    const count = document.getElementById("diaryCount");

    if (count) {
        count.textContent =
            entries.length === 1
                ? "1 entry"
                : entries.length + " entries";
    }

    if (entries.length === 0) {
        const empty = document.createElement("p");
        empty.className = "diary-empty";
        empty.textContent =
            "No entries yet. Write the first one above.";

        container.appendChild(empty);
        return;
    }

    for (const entry of entries) {
        const article = document.createElement("article");
        article.className = "diary-entry";

        const header = document.createElement("div");
        header.className = "diary-entry-header";

        const date = document.createElement("div");
        date.className = "diary-entry-date";
        date.textContent = formatDate(entry.date);

        const actions = document.createElement("div");
        actions.className = "diary-entry-actions";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", function () {
            startEditing(entry.id);
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", function () {
            deleteDiaryEntry(entry.id);
        });

        actions.append(editButton, deleteButton);
        header.append(date, actions);

        const content = document.createElement("div");
        content.className = "diary-entry-content";
        content.textContent = entry.text;

        article.append(header, content);
        container.appendChild(article);
    }
}


/*
 * YYYY-MM-DD as an unambiguous readable date. Built from the string
 * directly: passing it to the Date constructor would parse it as UTC
 * and shift the day backwards in this timezone.
 */

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];


function formatDate(date) {
    const parts = date.split("-");

    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);

    if (!month || month < 1 || month > 12) {
        return date;
    }

    return day + " " + MONTHS[month - 1] + " " + year;
}


/* ===============================================================
 * Export and import
 *
 * The JSON file is the one to commit: it round-trips back through
 * the import button. The Markdown file is for reading and for
 * pasting into the thesis document.
 * ============================================================= */

function downloadFile(filename, contents, mimeType) {
    const blob = new Blob([contents], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}


function today() {
    const now = new Date();

    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return now.getFullYear() + "-" + month + "-" + day;
}


function exportDiaryJson() {
    const entries = sortEntries(readDiary());

    if (entries.length === 0) {
        setDiaryStatus("There is nothing to export yet.", true);
        return;
    }

    downloadFile(
        "diary-" + today() + ".json",
        JSON.stringify(entries, null, 2),
        "application/json"
    );

    setDiaryStatus(
        "Exported " + entries.length + " entries as JSON. " +
        "Commit the file to the repository.",
        false
    );
}


function exportDiaryMarkdown() {
    const entries = sortEntries(readDiary());

    if (entries.length === 0) {
        setDiaryStatus("There is nothing to export yet.", true);
        return;
    }

    let markdown = "# Development Diary\n\n";

    for (const entry of entries) {
        markdown += "## " + formatDate(entry.date) + "\n\n";
        markdown += entry.text + "\n\n";
    }

    downloadFile(
        "diary-" + today() + ".md",
        markdown,
        "text/markdown"
    );

    setDiaryStatus(
        "Exported " + entries.length + " entries as Markdown.",
        false
    );
}


async function importDiaryJson(file) {
    let parsed = null;

    try {
        parsed = JSON.parse(await file.text());
    } catch (error) {
        setDiaryStatus("That file is not valid JSON.", true);
        return;
    }

    if (!Array.isArray(parsed)) {
        setDiaryStatus("That file does not contain a list of entries.", true);
        return;
    }

    const incoming = parsed.filter(isValidEntry).map(normalizeEntry);

    if (incoming.length === 0) {
        setDiaryStatus("No usable entries were found in that file.", true);
        return;
    }

    const existing = readDiary();

    const byId = new Map();

    for (const entry of existing) {
        byId.set(entry.id, entry);
    }

    let added = 0;
    let updated = 0;

    for (const entry of incoming) {
        if (byId.has(entry.id)) {
            updated += 1;
        } else {
            added += 1;
        }

        byId.set(entry.id, entry);
    }

    if (!writeDiary(Array.from(byId.values()))) {
        return;
    }

    setDiaryStatus(
        "Imported " + added + " new entries, replaced " + updated + ".",
        false
    );

    loadDiaryEntries();
}


/* ===============================================================
 * Search
 *
 * Searches the article text only, highlights every match and moves
 * through them one at a time. The sidebar and navigation are left
 * out, otherwise every section name matches itself.
 * ============================================================= */

let lastSearchTerm = "";
let currentHit = -1;


function setSearchStatus(message) {
    const status = document.getElementById("searchStatus");

    if (status) {
        status.textContent = message;
    }
}


function clearHighlights() {
    const marks = document.querySelectorAll("main mark.search-hit");

    for (const mark of marks) {
        const parent = mark.parentNode;
        parent.replaceChild(document.createTextNode(mark.textContent), mark);
        parent.normalize();
    }

    currentHit = -1;
}


function highlightMatches(term) {
    const main = document.querySelector("main");

    if (!main) {
        return 0;
    }

    const walker = document.createTreeWalker(
        main,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function (node) {
                if (node.nodeValue.toLowerCase().indexOf(term) === -1) {
                    return NodeFilter.FILTER_REJECT;
                }

                const parent = node.parentElement;

                if (!parent || parent.closest("script, style, textarea, button")) {
                    return NodeFilter.FILTER_REJECT;
                }

                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    const targets = [];

    while (walker.nextNode()) {
        targets.push(walker.currentNode);
    }

    let hits = 0;

    for (const node of targets) {
        const text = node.nodeValue;
        const lower = text.toLowerCase();

        const fragment = document.createDocumentFragment();

        let index = 0;
        let found = lower.indexOf(term, index);

        while (found !== -1) {
            if (found > index) {
                fragment.appendChild(
                    document.createTextNode(text.slice(index, found))
                );
            }

            const mark = document.createElement("mark");
            mark.className = "search-hit";
            mark.textContent = text.slice(found, found + term.length);

            fragment.appendChild(mark);
            hits += 1;

            index = found + term.length;
            found = lower.indexOf(term, index);
        }

        if (index < text.length) {
            fragment.appendChild(document.createTextNode(text.slice(index)));
        }

        node.parentNode.replaceChild(fragment, node);
    }

    return hits;
}


function goToHit(index) {
    const marks = document.querySelectorAll("main mark.search-hit");

    if (marks.length === 0) {
        return;
    }

    for (const mark of marks) {
        mark.classList.remove("is-current");
    }

    currentHit = ((index % marks.length) + marks.length) % marks.length;

    const target = marks[currentHit];
    target.classList.add("is-current");
    target.scrollIntoView({ block: "center", behavior: "smooth" });

    setSearchStatus("Match " + (currentHit + 1) + " of " + marks.length);
}


function searchPage() {
    const input = document.getElementById("searchInput");
    const term = input.value.toLowerCase().trim();

    if (term === "") {
        clearHighlights();
        lastSearchTerm = "";
        setSearchStatus("");
        return;
    }

    /*
     * Searching again for the same term steps to the next match
     * instead of starting over.
     */

    if (term === lastSearchTerm && document.querySelector("main mark.search-hit")) {
        goToHit(currentHit + 1);
        return;
    }

    clearHighlights();

    const hits = highlightMatches(term);

    lastSearchTerm = term;

    if (hits === 0) {
        setSearchStatus("No matches for \u201C" + input.value.trim() + "\u201D");
        return;
    }

    goToHit(0);
}


/* ===============================================================
 * Wiring
 * ============================================================= */

function init() {
    renderComponents();
    loadDiaryEntries();

    document
        .getElementById("searchButton")
        .addEventListener("click", searchPage);

    document
        .getElementById("searchInput")
        .addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                searchPage();
            }

            if (event.key === "Escape") {
                clearHighlights();
                lastSearchTerm = "";
                setSearchStatus("");
            }
        });

    document
        .getElementById("diarySaveButton")
        .addEventListener("click", saveDiaryEntry);

    document
        .getElementById("diaryCancelButton")
        .addEventListener("click", cancelEditing);

    document
        .getElementById("exportJsonButton")
        .addEventListener("click", exportDiaryJson);

    document
        .getElementById("exportMarkdownButton")
        .addEventListener("click", exportDiaryMarkdown);

    document
        .getElementById("importButton")
        .addEventListener("click", function () {
            document.getElementById("importInput").click();
        });

    document
        .getElementById("importInput")
        .addEventListener("change", function (event) {
            const file = event.target.files[0];

            if (file) {
                importDiaryJson(file);
            }

            event.target.value = "";
        });

    /*
     * Default the date field to today so an entry is never saved
     * against an empty or stale date by accident.
     */

    const dateInput = document.getElementById("diaryDate");

    if (dateInput && dateInput.value === "") {
        dateInput.value = today();
    }
}


if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}