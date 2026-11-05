"use strict";

/* ===============================================================
 * Compiler Architecture
 *
 * Renders the compilation pipeline as a list of stage blocks and a
 * detail panel for the selected stage.
 *
 * Implementation status is not stored here. Each stage names the
 * entry of COMPONENTS (script.js) that tracks it, so the status shown
 * in the pipeline always matches the sidebar and the Compiler table.
 *
 * The algorithms listed are the standard techniques for each stage
 * (Aho et al., 2006; Cooper & Torczon, 2012). They describe the
 * topic, not what this compiler currently uses.
 * ============================================================= */

(function () {

    const STAGES = [
        {
            name: "Source Code",
            component: null,
            edge: "characters",
            summary: "The program text written by the programmer.",
            purpose:
                "Holds the program as plain text. It is the only input of " +
                "the compiler and has no structure yet beyond what the " +
                "language grammar will later give it.",
            input: "A source file.",
            output: "A stream of characters, with line and column positions.",
            techniques: [
                "Reading the file into a memory buffer.",
                "Tracking line and column numbers for error messages."
            ],
            relation:
                "Source positions are carried through every later stage, " +
                "so an error found late can still point at the right line.",
            statusNote:
                "Not a compiler component: it is the input of the pipeline."
        },
        {
            name: "Lexical Analysis (Lexer)",
            component: "Lexer",
            edge: "tokens",
            summary: "Groups characters into tokens.",
            purpose:
                "Splits the character stream into tokens such as keywords, " +
                "identifiers, literals, operators and punctuation. " +
                "Whitespace and comments are discarded. Invalid characters " +
                "are reported here.",
            input: "The character stream of the source file.",
            output:
                "A sequence of tokens, each with a type, the matched text " +
                "(lexeme) and a source position.",
            techniques: [
                "Finite automata and regular expressions.",
                "Longest-match rule (maximal munch).",
                "Keyword lookup table.",
                "Dynamic array of tokens."
            ],
            relation:
                "Its tokens are the only thing the parser sees, so the " +
                "parser never has to deal with whitespace or comments.",
            statusNote: "Documented on its own page.",
            link: { href: "compiler/lexer.html", text: "Lexer documentation" }
        },
        {
            name: "Syntax Analysis (Parser)",
            component: "Parser",
            edge: "AST",
            summary: "Checks the grammar and builds the syntax tree.",
            purpose:
                "Checks that the tokens follow the grammar of the language " +
                "and builds an Abstract Syntax Tree (AST) that shows how " +
                "statements and expressions nest. Reports syntax errors.",
            input: "The token sequence from the lexer.",
            output: "An Abstract Syntax Tree (AST).",
            techniques: [
                "Recursive descent parsing.",
                "Operator precedence parsing for expressions.",
                "LL and LR parsing as table-driven alternatives.",
                "Tree nodes with a kind and a list of children."
            ],
            relation:
                "Turns a flat list of tokens into a tree, which is the " +
                "structure semantic analysis and IR generation walk over.",
            statusNote: ""
        },
        {
            name: "Semantic Analysis",
            component: "Semantic analysis",
            edge: "annotated AST",
            summary: "Checks meaning: scopes and types.",
            purpose:
                "Checks rules that a grammar cannot express: variables are " +
                "declared before use, operand types are compatible, " +
                "function calls match their declarations. Attaches types " +
                "to the AST.",
            input: "The AST.",
            output: "An AST annotated with types, and a symbol table.",
            techniques: [
                "Symbol tables, usually one per scope.",
                "Tree walks that compute and check types.",
                "Rules for implicit type conversions."
            ],
            relation:
                "Rejects invalid programs before any code is generated, so " +
                "IR generation can assume the program is well formed.",
            statusNote: ""
        },
        {
            name: "Intermediate Representation (IR) Generation",
            component: "Intermediate representation",
            edge: "IR",
            summary: "Lowers the tree to a simpler internal form.",
            purpose:
                "Translates the annotated AST into an Intermediate " +
                "Representation: a simple, machine-independent form where " +
                "each instruction does one small operation. The " +
                "optimizations are applied to this form.",
            input: "The annotated AST and the symbol table.",
            output:
                "IR, commonly three-address code grouped into basic blocks " +
                "and connected by a control-flow graph.",
            techniques: [
                "Tree walk that breaks expressions into temporaries.",
                "Partitioning code into basic blocks.",
                "Control-flow graph (CFG).",
                "Static single assignment (SSA) form, if used (Cytron et al., 1991)."
            ],
            relation:
                "The design of the IR decides which analyses are easy, so " +
                "it shapes both the optimizer and the code generator.",
            statusNote: ""
        },
        {
            name: "Optimization Passes",
            component: "Optimizer",
            edge: "optimized IR",
            focus: true,
            summary: "Rewrites the IR to run faster or take less space.",
            purpose:
                "Transforms the IR into an equivalent IR that executes " +
                "faster or is smaller, without changing what the program " +
                "does. The research studies seven classic passes: " +
                "constant folding, constant propagation, dead code " +
                "elimination, common subexpression elimination, " +
                "loop-invariant code motion, loop unrolling and " +
                "auto-vectorization. Each one can be switched on or off.",
            input: "IR, plus the results of analyses run on it.",
            output: "Optimized IR with the same observable behavior.",
            techniques: [
                "Iterative data-flow analysis (Kildall, 1973): reaching definitions, liveness, available expressions.",
                "Dominators and natural-loop detection, for the loop passes.",
                "Dependence analysis, for vectorization.",
                "Basic blocks and the CFG built by the previous stage."
            ],
            relation:
                "The passes interact: folding and propagation create dead " +
                "code for DCE to remove, and unrolling can expose common or " +
                "invariant subexpressions. See the Optimization Playground " +
                "for an example of each pass.",
            statusNote: "Primary focus of this research.",
            link: {
                href: "#optimization-playground",
                text: "Try the Optimization Playground"
            }
        },
        {
            name: "Code Generation",
            component: "Code generation",
            edge: "machine instructions",
            summary: "Chooses x86-64 instructions and registers.",
            purpose:
                "Maps the optimized IR to x86-64 instructions: selects " +
                "which instructions implement each IR operation, assigns " +
                "registers and stack slots to values, and follows the " +
                "calling convention.",
            input: "Optimized IR.",
            output:
                "A sequence of x86-64 machine instructions with registers " +
                "assigned.",
            techniques: [
                "Instruction selection by tree pattern matching.",
                "Liveness analysis.",
                "Register allocation by graph coloring or linear scan.",
                "Stack frame layout and the System V calling convention."
            ],
            relation:
                "Its quality depends on the IR it receives: removing " +
                "redundant work earlier means fewer instructions to select " +
                "and fewer values competing for registers.",
            statusNote: ""
        },
        {
            name: "Assembly / Object Code Generation",
            component: "Code generation",
            edge: null,
            summary: "Writes assembly text or encoded machine code.",
            purpose:
                "Writes the instructions out, either as assembly text or " +
                "as binary machine code inside an object file, ready to be " +
                "linked into an executable.",
            input: "x86-64 machine instructions.",
            output:
                "An assembly file (.s) or a relocatable object file (.o).",
            techniques: [
                "Instruction encoding: opcode, ModRM byte, immediates.",
                "Symbol table and relocations.",
                "Object file sections such as .text and .data."
            ],
            relation:
                "The last stage of the compiler itself. A linker combines " +
                "the object file with libraries to produce the executable. " +
                "The Assembly Explorer shows what this output looks like.",
            statusNote:
                "Tracked together with Code Generation in the component list.",
            link: {
                href: "#assembly-explorer",
                text: "Open the Assembly Explorer"
            }
        }
    ];

    let selected = -1;


    function byId(id) {
        return document.getElementById(id);
    }


    function makeSpan(className, text) {
        const span = document.createElement("span");
        span.className = className;
        span.textContent = text;
        return span;
    }


    /*
     * Status comes from COMPONENTS in script.js. A stage with no
     * component is an input, not something that can be "complete".
     */

    function stageStatus(stage) {
        if (stage.component === null) {
            return { label: "Input", cls: "" };
        }

        if (typeof COMPONENTS !== "undefined") {
            const found = COMPONENTS.find(function (component) {
                return component.name === stage.component;
            });

            if (found) {
                return {
                    label: found.status,
                    cls: typeof statusClass === "function"
                        ? statusClass(found.status)
                        : ""
                };
            }
        }

        return { label: "Not tracked", cls: "" };
    }


    /* -----------------------------------------------------------
     * Pipeline
     * --------------------------------------------------------- */

    function buildPipeline() {
        const list = byId("pipelineStages");

        list.textContent = "";

        STAGES.forEach(function (stage, index) {
            const item = document.createElement("li");

            const button = document.createElement("button");
            button.type = "button";
            button.className = "pipeline-stage";
            button.setAttribute("aria-controls", "stageDetails");

            if (stage.focus) {
                button.classList.add("pipeline-stage--focus");
            }

            const number = makeSpan("stage-number", String(index + 1));
            number.setAttribute("aria-hidden", "true");

            const name = makeSpan("stage-name", stage.name);

            const status = stageStatus(stage);
            const meta = makeSpan("stage-meta", "");
            meta.appendChild(makeSpan("stage-status " + status.cls, status.label));

            if (stage.focus) {
                meta.appendChild(makeSpan("stage-badge", "Research focus"));
            }

            button.append(number, name, meta);

            button.addEventListener("click", function () {
                select(index, true);
            });

            item.appendChild(button);

            if (stage.edge !== null) {
                const edge = makeSpan("pipeline-edge", stage.edge);
                edge.setAttribute("aria-hidden", "true");
                item.appendChild(edge);
            }

            list.appendChild(item);
        });
    }


    /* -----------------------------------------------------------
     * Detail panel
     * --------------------------------------------------------- */

    function fillList(list, items) {
        list.textContent = "";

        for (const text of items) {
            const item = document.createElement("li");
            item.textContent = text;
            list.appendChild(item);
        }
    }


    function fillPanel(index) {
        const stage = STAGES[index];
        const previous = STAGES[index - 1];
        const next = STAGES[index + 1];

        byId("stageTitle").textContent = stage.name;
        byId("stagePosition").textContent =
            "Stage " + (index + 1) + " of " + STAGES.length;
        byId("stageSummary").textContent = stage.summary;

        byId("stagePurpose").textContent = stage.purpose;
        byId("stageInput").textContent = stage.input;
        byId("stageOutput").textContent = stage.output;
        fillList(byId("stageTechniques"), stage.techniques);

        const flow =
            (previous
                ? "Receives its input from " + previous.name + ". "
                : "First stage: nothing comes before it. ") +
            (next
                ? "Passes its output to " + next.name + "."
                : "Last stage of the compiler itself.");

        byId("stageFlow").textContent = flow;
        byId("stageRelation").textContent = stage.relation;

        const status = stageStatus(stage);
        const statusElement = byId("stageStatus");

        statusElement.textContent = "";
        statusElement.appendChild(
            makeSpan("stage-status " + status.cls, status.label)
        );

        if (stage.statusNote !== "") {
            statusElement.appendChild(document.createTextNode(" " + stage.statusNote));
        }

        const linkItem = byId("stageLink");

        linkItem.textContent = "";

        if (stage.link) {
            const anchor = document.createElement("a");
            anchor.href = stage.link.href;
            anchor.textContent = stage.link.text;
            linkItem.appendChild(anchor);
        }

        linkItem.hidden = !stage.link;
        byId("stageFocus").hidden = !stage.focus;

        byId("stagePrevious").disabled = index === 0;
        byId("stageNext").disabled = index === STAGES.length - 1;
    }


    function select(index, fromPipeline) {
        if (index < 0 || index >= STAGES.length) {
            return;
        }

        selected = index;

        const buttons = document.querySelectorAll("#pipelineStages .pipeline-stage");

        buttons.forEach(function (button, position) {
            if (position === index) {
                button.setAttribute("aria-current", "step");
            } else {
                button.removeAttribute("aria-current");
            }
        });

        fillPanel(index);

        /*
         * When the layout is one column, the panel sits below the
         * whole pipeline and would be out of sight after a click.
         */

        if (fromPipeline && window.matchMedia("(max-width: 960px)").matches) {
            byId("stagePanel").scrollIntoView({ block: "start" });
        }
    }


    function step(offset, ownButton, otherButton) {
        select(selected + offset, false);

        /*
         * A disabled button cannot keep focus, so move it to the
         * other one instead of dropping it back to the page.
         */

        if (ownButton.disabled) {
            otherButton.focus();
        }
    }


    function init() {
        if (!byId("pipelineStages")) {
            return;
        }

        buildPipeline();

        const previous = byId("stagePrevious");
        const next = byId("stageNext");

        previous.addEventListener("click", function () {
            step(-1, previous, next);
        });

        next.addEventListener("click", function () {
            step(1, next, previous);
        });

        select(0, false);
    }


    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();