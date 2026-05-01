/**
 * Dreadlight - Compendium Icon Refresh Macro
 * Run this as a Foundry Script Macro to update existing system packs without
 * clearing or recreating their item data.
 */

const COMPENDIUM_ICON_ROOT = "systems/dreadlight/assets/icons/compendium";
const PACK_NAMES = ["backgrounds", "drives", "talents", "dreadlore", "weapons", "armor", "equipment"];

function iconSlug(name) {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getSystemPack(packName) {
  const collection = `dreadlight.${packName}`;
  return Array.from(game.packs.values()).find((pack) =>
    pack.collection === collection
    || (pack.metadata?.packageName === "dreadlight" && pack.metadata?.name === packName)
  );
}

async function refreshPackIcons(packName) {
  const pack = getSystemPack(packName);
  if (!pack) {
    ui.notifications.warn(`Dreadlight | Pack dreadlight.${packName} not found.`);
    return 0;
  }

  await pack.configure({ locked: false });
  const documents = await pack.getDocuments();
  const updates = documents.map((document) => ({
    _id: document.id,
    img: `${COMPENDIUM_ICON_ROOT}/${packName}/${iconSlug(document.name)}.svg`,
  }));

  if (updates.length) await Item.updateDocuments(updates, { pack: pack.collection });
  await pack.configure({ locked: true });
  return updates.length;
}

const confirmed = await Dialog.confirm({
  title: "Refresh Dreadlight Compendium Icons",
  content: `<p>This updates item images in all Dreadlight system compendiums to the custom local SVG icon set.</p>
  <p>It does not delete, recreate, or otherwise modify item rules text.</p>`,
});

if (confirmed) {
  let total = 0;
  for (const packName of PACK_NAMES) total += await refreshPackIcons(packName);
  ui.notifications.info(`Dreadlight | Updated ${total} compendium item icons.`);
} else {
  ui.notifications.warn("Dreadlight | Compendium icon refresh cancelled.");
}
