# 英寸号单做一轮：登记文字草稿（没写进 decisions.md）

2026-11-20 起草，给 Leo 看。**这段文字现在不进 decisions.md**；你看过以后，跟下一次提交一起写进 Open items，并在 "Where the order stands" 加一行。

## 中文说明（给你看的）

- 名字：我暂定 **12e-3**。这样 12f 和第 13 项的编号都不用动，照 12e-2 当时的起法。叫什么由你定。
- 位置：12e-2 之后、12f 之前。
- 12e-2 只做镜头和标签，词典和格式函数一个字不动。
- 这一轮的范围：页面上所有写英寸号的地方，并到一个出字的地方，再加守护测试。统一成 ″ 还是 "、分数还是小数，等你定。

## 准备写进 decisions.md 的原文（英文照文件的写法，你的话照原样）

Open items，接在 12e-2 那一条后面：

> 12e-3. **The inch marks made one: one place writes every inch figure on the page** *(registered 2026-11-20; split out of 12e-2, after it and before 12f; numbered 12e-3 so that 12f and 13 keep their numbers)*. Leo, 2026-11-20: 「英寸号从 12e-2 里拆出去，单做一轮，排在 12e-2 后面、12f 前面。12e-2 只做镜头和标签，词典和格式函数一个字不动。」 Registered only. What 12e-2's third draft counted (read only, 2026-11-20, `docs/plans/item12e2-2026-11-19/`): ″ and " side by side in the dictionaries (en.json 3 and 131, zh.json 66 and 69, reviewed.json's English 3 and 41 and Chinese 26 and 18), and no one place that writes them. When its turn comes, a plan first:
> - **In scope, all of it into one place that writes an inch figure**, with a guard test that turns red on any other:
>   - the dictionaries, `src/i18n/en.json` and `src/i18n/zh.json`, and the approved lines in `src/i18n/reviewed.json` that carry an inch mark (each changed one read again by Leo before it is entered);
>   - the three formatting functions: `formatDimension` (`src/data/dimensions.ts`, fractions to a sixteenth, `"`), `formatInches` (`src/data/fit.ts`, one decimal, `"`), `inchesSpoken` (`src/data/inches.ts`, eighths as `¾`, `″`);
>   - the two written by hand: `feetInches` in `src/ui/LeftPanel.tsx` (`16′10″`) and the tile sizes in `src/store/finishes.ts` (`24″ × 48″`);
>   - the fraction formatter written again in `src/data/roughIn.ts` (the same rule as `formatDimension`, D17's "one rule written twice");
>   - the slider's default format in `src/ui/primitives.tsx` (`${n}"`);
>   - the 75 lines that write `"` straight into a string in code (13 files; on the page: `layoutRules.ts`'s 53, `hood.ts`, `quote.ts`, `utilities.ts`; the developer-only error messages listed in the plan).
> - **For Leo to decide, as questions in the plan**: which mark, ″ or "; fractions or decimals, and to what step (a sixteenth, an eighth, one decimal); whether Chinese and English are the same.
> - **The guard**: a unit test that reads `src/` and fails on an inch mark written anywhere but the one place (as `sceneFrame.test.ts` holds `useFrame` to one file); a dictionary test that allows only the chosen mark, after a placeholder or a figure; on the page, the 45 pixel states' recorded text holding only the chosen mark. Each broken on purpose before it is trusted.
> - **The proof**: its own pixel proof (only text with an inch mark meant to change; the 3D canvas the same in all 45 states), the dumps, and a full suite of its own.

"Where the order stands" 加一行（接在 12e-2 那一行后面）：

> - 12e-3, the inch marks made one — split out of 12e-2 (Leo, 2026-11-20); waits for 12e-2, then a plan first and Leo's choice of mark and form.

原来 12e-2 下面那条 "The inch marks in the dictionaries made one"：原文不改写，旁边注明：

> *Moved to 12e-3 (Leo, 2026-11-20); 12e-2 changes no dictionary and no formatter.*
