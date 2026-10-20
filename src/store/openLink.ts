import { EVENTS, countEvent } from "../analytics";
import { candidatesFor } from "../data/candidates";
import { APPLIANCE_BY_ID, blowersFor, migrateBlower } from "../data/catalogue";
import { setLayoutParams, setLayoutParamsGrowing } from "../data/layoutState";
import { PACKAGE_BY_ID } from "../data/packages";
import { LAYOUT_PARAMS } from "../data/room";
import {
  BLOWER_FIELD,
  FINISH_FIELDS,
  LANG_FIELD,
  LAYOUT_FIELDS,
  applianceByModel,
  modelFieldsOf,
  readField,
  readLink,
  writeLink,
  type Kitchen,
} from "./shareLink";
import { useAppStore, type NoticeLine } from "./useAppStore";

/**
 * A page opened from a share link builds the kitchen the link carries.
 * Round 94, Leo; docs/decisions.md D23.
 *
 * Each setting is put through the same path a customer's own choice goes
 * through — the package switch, a model picked on the card, a finish picked in
 * the panel — and checked first by what the page already asks (D17's table,
 * first row: no judgement of its own):
 * - a model: in the catalogue, then `candidatesFor` — the list and the card's
 *   own answer — and offered and fitting there, as a chip on the card would be;
 * - a blower: in the catalogue, and where the hood needs one, among
 *   `blowersFor` the hood (the blower list's own);
 * - the layout: the template builds it (`setLayoutParams`), or grows a wall to
 *   take it as any switch does (D18), or the package's own room stands;
 * - a finish or the language: the table's own reading of its value.
 *
 * What does not pass is shown as the page would show it otherwise — the
 * package's own — and said, one line each, in Leo's words (reviewed.json).
 * Nothing is reported as changed: the lines say what the link had and what is
 * shown (D10).
 *
 * Opening a link is the page loading. The camera starts at the default view,
 * as every page does; nothing here moves it (D1, D23). And there is nothing to
 * undo: no room stood in this tab before it, so no line offers Undo.
 */
export function openSharedLink(search: string): void {
  const query = new URLSearchParams(search);
  const link = readLink(query);
  if (link.kind === "none") return;
  const store = useAppStore;
  if (link.kind === "unreadable") {
    store.setState({ toast: { id: Date.now(), key: "share.notice.unreadable", notice: "unreadable" } });
    return;
  }

  const lines: NoticeLine[] = [];
  const entry = PACKAGE_BY_ID[link.packageId];

  // The language first, so everything after it is said in it.
  const lang = readField(LANG_FIELD, query);
  if (lang.state === "ok") store.getState().setLang(lang.value);
  else lines.push({ kind: "setting", field: LANG_FIELD.name, to: store.getState().lang });

  // The package, as its button switches it.
  store.getState().setPackageId(link.packageId);
  if (store.getState().packageId !== link.packageId) {
    store.setState({ toast: { id: Date.now(), key: "share.notice.unreadable", notice: "unreadable" } });
    return;
  }
  // Counted on the live site, with the package's letter, once the link's
  // package stands; a link that cannot be read is not (Leo, D24).
  countEvent(EVENTS.openLink(entry.code));

  // The layout, all of it asked at once, over the package's own room.
  const standing = store.getState().layoutParams;
  // A field a link of its version did not carry yet is not read: the link
  // was written when the page had only one value for it, and that is what it
  // gets, with nothing said (round 98a: a `v=1` link is an L).
  const version = Number(query.get("v"));
  const older = (field: (typeof LAYOUT_FIELDS)[number]) => field.since !== undefined && version < field.since.version;
  let asked = { ...standing };
  for (const field of LAYOUT_FIELDS) {
    if (older(field)) asked = { ...asked, ...field.put(field.since!.before) };
  }
  const reads = LAYOUT_FIELDS.filter((field) => !older(field)).map((field) => ({ field, read: readField(field, query) }));
  for (const { field, read } of reads) {
    if (read.state === "ok") asked = { ...asked, ...field.put(read.value) };
  }
  let built = asked;
  if (!setLayoutParams(asked).ok) {
    const grown = setLayoutParamsGrowing(asked);
    if (grown.ok) built = grown.params;
    else {
      setLayoutParams(standing);
      built = standing;
    }
  }
  store.setState((s) => ({ layoutParams: built, layoutIssues: [], layoutVersion: s.layoutVersion + 1 }));
  for (const { field, read } of reads) {
    const shown = field.get(built);
    if (read.state !== "ok" || field.write(shown) !== field.write(read.value)) {
      lines.push({ kind: "setting", field: field.name, to: shown });
    }
  }

  // Each opening's model, as a pick on the card makes it.
  for (const field of modelFieldsOf(entry.id)) {
    const read = readField(field, query);
    const shown = () => store.getState().selection[field.slotId];
    if (read.state !== "ok") {
      lines.push({ kind: "setting", field: field.name, to: shown() });
      continue;
    }
    const appliance = applianceByModel(read.value);
    if (!appliance) {
      lines.push({ kind: "catalogue", field: field.name, from: read.value, to: shown() });
      continue;
    }
    const offered = candidatesFor(field.slotId, entry).find(
      (candidate) => candidate.appliance.id === appliance.id,
    );
    if (offered?.fit.fits && shown() !== appliance.id) {
      store.getState().selectAppliance(field.slotId, appliance.id);
    }
    if (shown() !== appliance.id) {
      lines.push({ kind: "fit", field: field.name, from: appliance.id, to: shown() });
    }
  }

  // The blower, which the page keeps as it was chosen.
  const hood = APPLIANCE_BY_ID[store.getState().selection["slot-hood"]];
  const blower = readField(BLOWER_FIELD, query);
  const kept = store.getState().blowerId ?? "none";
  if (blower.state !== "ok") {
    lines.push({ kind: "setting", field: BLOWER_FIELD.name, to: kept });
  } else if (blower.value.toLowerCase() === "none") {
    store.getState().selectBlower(null);
  } else {
    const chosen = applianceByModel(blower.value);
    if (!chosen || chosen.category !== "blower") {
      lines.push({ kind: "catalogue", field: BLOWER_FIELD.name, from: blower.value, to: kept });
    } else if (hood.blower === "required" && !blowersFor(hood).some((option) => option.id === chosen.id)) {
      // What a package switch would give this hood: the package's own blower.
      const instead = migrateBlower(entry, hood, null);
      store.getState().selectBlower(instead);
      lines.push({ kind: "fit", field: BLOWER_FIELD.name, from: chosen.id, to: instead ?? "none" });
    } else {
      store.getState().selectBlower(chosen.id);
    }
  }

  // The finishes, each as its control sets it.
  for (const field of FINISH_FIELDS) {
    const read = readField(field, query);
    if (read.state === "ok") store.getState().setFinish(field.put(read.value));
    else lines.push({ kind: "setting", field: field.name, to: field.get(store.getState().finishes) });
  }

  // Nothing selected, and no message about a room growing: the package switch
  // above raises one, and here it is the link's room, not a change.
  store.setState({
    selectedSlot: null,
    toast: lines.length > 0 ? { id: Date.now(), key: "share.notice.except", notice: lines } : null,
  });
}

/**
 * The kitchen on screen, as a link carries it.
 *
 * The room as it was built (`LAYOUT_PARAMS`), not the parameters as last asked
 * for: a slider dragged to a wall that is refused leaves the asked figure on
 * the control and the room standing as it was (D14), and the link is of the
 * room standing.
 */
export function kitchenNow(): Kitchen {
  const s = useAppStore.getState();
  return {
    packageId: s.packageId,
    lang: s.lang,
    layoutParams: LAYOUT_PARAMS,
    selection: s.selection,
    blowerId: s.blowerId,
    finishes: s.finishes,
  };
}

/** The link to the kitchen on screen: this page's own address and the table's query. */
export function shareUrl(): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}?${writeLink(kitchenNow())}`;
}
