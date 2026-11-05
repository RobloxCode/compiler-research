"use strict";

/* ===============================================================
 * Syntax highlighting
 *
 * A small, dependency-free highlighter for the C-like samples and the
 * Intel-syntax assembly shown on this page. It works one line at a
 * time and builds DOM nodes with textContent, never innerHTML, so the
 * code is always displayed as text.
 *
 * Exposes one global, CodeHighlight, used by the Optimization
 * Playground and the Assembly Explorer.
 * ============================================================= */

const CodeHighlight = (function () {

    /* -----------------------------------------------------------
     * C
     * --------------------------------------------------------- */

    const C_KEYWORDS = new Set([
        "for", "while", "do", "if", "else", "return", "break",
        "continue", "const", "static", "restrict", "sizeof"
    ]);

    const C_TYPES = new Set([
        "int", "float", "double", "char", "void", "long", "short",
        "unsigned", "signed", "__m128"
    ]);

    /*
     * Groups: 1 comment, 2 preprocessor line, 3 number, 4 word.
     */

    const C_PATTERN =
        /(\/\/.*$)|(^\s*#.*$)|(\b0[xX][0-9a-fA-F]+\b|\b\d+(?:\.\d+)?[fFuUlL]*\b)|([A-Za-z_]\w*)/g;


    function tokenizeC(line) {
        const tokens = [];
        let last = 0;
        let match = null;

        C_PATTERN.lastIndex = 0;

        while ((match = C_PATTERN.exec(line)) !== null) {
            if (match.index > last) {
                tokens.push({ cls: null, text: line.slice(last, match.index) });
            }

            let cls = null;

            if (match[1] !== undefined) {
                cls = "tok-comment";
            } else if (match[2] !== undefined) {
                cls = "tok-preproc";
            } else if (match[3] !== undefined) {
                cls = "tok-number";
            } else if (C_KEYWORDS.has(match[4])) {
                cls = "tok-keyword";
            } else if (C_TYPES.has(match[4])) {
                cls = "tok-type";
            } else if (line.charAt(C_PATTERN.lastIndex) === "(") {
                cls = "tok-function";
            }

            tokens.push({ cls: cls, text: match[0] });
            last = C_PATTERN.lastIndex;
        }

        if (last < line.length) {
            tokens.push({ cls: null, text: line.slice(last) });
        }

        return tokens;
    }


    /* -----------------------------------------------------------
     * x86-64, Intel syntax
     *
     * An instruction is a mnemonic followed by comma-separated
     * operands. Groups: 1 size keyword, 2 register, 3 number,
     * 4 any other name (a jump or call target).
     * --------------------------------------------------------- */

    const ASM_LINE = /^(\s*)([A-Za-z][A-Za-z0-9]*)(.*)$/;

    const ASM_OPERAND =
        /(\b(?:BYTE|WORD|DWORD|QWORD) PTR\b)|(\b(?:[re]?[abcd]x|[re]?[sd]i|[re]?[sb]p|r(?:8|9|1[0-5])[dwb]?|[abcd][lh]|[xy]mm\d{1,2})\b)|(-?\b(?:0[xX][0-9a-fA-F]+|\d+)\b)|([.A-Za-z_][\w.$]*)/gi;


    function tokenizeAsm(line) {
        const tokens = [];
        const parts = ASM_LINE.exec(line);

        if (parts === null) {
            return [{ cls: null, text: line }];
        }

        if (parts[1] !== "") {
            tokens.push({ cls: null, text: parts[1] });
        }

        tokens.push({ cls: "tok-mnemonic", text: parts[2] });

        const rest = parts[3];
        let last = 0;
        let match = null;

        ASM_OPERAND.lastIndex = 0;

        while ((match = ASM_OPERAND.exec(rest)) !== null) {
            if (match.index > last) {
                tokens.push({ cls: null, text: rest.slice(last, match.index) });
            }

            let cls = "tok-label";

            if (match[1] !== undefined) {
                cls = "tok-size";
            } else if (match[2] !== undefined) {
                cls = "tok-register";
            } else if (match[3] !== undefined) {
                cls = "tok-number";
            }

            tokens.push({ cls: cls, text: match[0] });
            last = ASM_OPERAND.lastIndex;
        }

        if (last < rest.length) {
            tokens.push({ cls: null, text: rest.slice(last) });
        }

        return tokens;
    }


    /* -----------------------------------------------------------
     * Rendering
     * --------------------------------------------------------- */

    function appendTokens(parent, tokens) {
        for (const token of tokens) {
            if (token.cls === null) {
                parent.appendChild(document.createTextNode(token.text));
            } else {
                const span = document.createElement("span");
                span.className = token.cls;
                span.textContent = token.text;
                parent.appendChild(span);
            }
        }
    }


    function appendC(parent, line) {
        appendTokens(parent, tokenizeC(line));
    }


    function appendAsm(parent, line) {
        appendTokens(parent, tokenizeAsm(line));
    }


    /*
     * Fills container with one block element per line, so each line
     * can be numbered, marked or linked from CSS.
     *
     * options.language  "c" (default) or "asm"
     * options.marks     { lineNumber: "old" | "new" }, 1-based
     *
     * Returns the line elements in order.
     */

    function renderLines(container, lines, options) {
        const settings = options || {};
        const marks = settings.marks || {};
        const highlight = settings.language === "asm" ? appendAsm : appendC;
        const elements = [];

        container.textContent = "";

        lines.forEach(function (text, index) {
            const line = document.createElement("span");
            line.className = "code-line";

            if (marks[index + 1]) {
                line.classList.add("is-" + marks[index + 1]);
            }

            highlight(line, text);
            container.appendChild(line);
            elements.push(line);
        });

        return elements;
    }


    return {
        appendC: appendC,
        appendAsm: appendAsm,
        renderLines: renderLines
    };

})();