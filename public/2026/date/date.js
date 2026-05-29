(async function () {
  await SkillsStore.ready();

  const form = document.querySelector("#date-form");
  const titleInput = document.querySelector("#date-title");
  const imageInput = document.querySelector("#date-image");
  const preview = document.querySelector("#date-preview");
  const message = document.querySelector("#date-message");
  const gallery = document.querySelector("#date-gallery");
  const purgeVotes = document.querySelector("#purge-votes");
  const voterList = document.querySelector("#voter-list");
  const template = document.querySelector("#date-card-template");
  const activeVoterKey = "mercantec-kryds-bolle-active-voter";
  const dateImageOptions = {
    maxWidth: 1000,
    maxHeight: 760,
    quality: 0.7,
    minQuality: 0.42,
    maxBytes: 420000
  };

  let selectedImage = "";
  let items = SkillsStore.loadDateItems();

  init();

  async function init() {
    await compactStoredImages();
    render();
  }

  imageInput.addEventListener("change", async () => {
    const file = imageInput.files[0];
    if (!file) return;

    setMessage("Pakker billedet ned...");
    selectedImage = await SkillsStore.fileToDataUrl(file, dateImageOptions);
    preview.replaceChildren();

    const image = document.createElement("img");
    image.src = selectedImage;
    image.alt = "";
    preview.append(image);
    preview.hidden = false;
    setMessage("Billedet er klar til at blive gemt.");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selectedImage) return;

    const nextItems = [
      {
        id: SkillsStore.createId(),
        title: titleInput.value.trim(),
        image: selectedImage,
        createdAt: new Date().toISOString()
      },
      ...items
    ];

    try {
      SkillsStore.saveDateItems(nextItems);
      items = nextItems;
    } catch (error) {
      if (!SkillsStore.isQuotaExceeded(error)) throw error;

      setMessage("Browserens billedlager er fuldt. Jeg pr\u00f8ver at pakke billederne h\u00e5rdere ned...");
      const compacted = await compactItems(nextItems, {
        ...dateImageOptions,
        maxWidth: 760,
        maxHeight: 580,
        quality: 0.58,
        minQuality: 0.34,
        maxBytes: 250000
      });

      try {
        SkillsStore.saveDateItems(compacted);
        items = compacted;
      } catch (secondError) {
        if (!SkillsStore.isQuotaExceeded(secondError)) throw secondError;
        setMessage("Der er stadig ikke plads. Slet et gammelt date-billede og pr\u00f8v igen.");
        return;
      }
    }

    form.reset();
    selectedImage = "";
    preview.hidden = true;
    preview.replaceChildren();
    setMessage("Billedet er gemt.");
    render();
  });

  gallery.addEventListener("click", (event) => {
    const button = event.target.closest(".delete-link");
    if (!button) return;
    items = items.filter((item) => item.id !== button.dataset.id);
    SkillsStore.saveDateItems(items);
    setMessage("Billedet er slettet.");
    render();
  });

  purgeVotes.addEventListener("click", () => {
    if (!confirm("Slet alle publikumsstemmer og hele listen over v\u00e6lgere?")) return;

    SkillsStore.saveVotes({});
    sessionStorage.removeItem(activeVoterKey);
    setMessage("Publikumsstemmer er slettet.");
    renderVoterList();
  });

  async function compactStoredImages() {
    items = SkillsStore.loadDateItems();
    if (items.length === 0) return;

    const compacted = await compactItems(items, dateImageOptions);
    const changed = compacted.some((item, index) => item.image !== items[index].image);

    if (!changed) return;

    try {
      SkillsStore.saveDateItems(compacted);
      items = compacted;
    } catch (error) {
      if (!SkillsStore.isQuotaExceeded(error)) throw error;
    }
  }

  async function compactItems(sourceItems, options) {
    const compacted = [];

    for (const item of sourceItems) {
      compacted.push({
        ...item,
        image: await SkillsStore.compressDataUrl(item.image, options)
      });
    }

    return compacted;
  }

  function render() {
    items = SkillsStore.loadDateItems();
    renderVoterList();
    gallery.replaceChildren();

    if (items.length === 0) {
      gallery.append(emptyState("Ingen billeder endnu", "Upload det f\u00f8rste billede til date-siden."));
      return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      const card = template.content.firstElementChild.cloneNode(true);
      const image = card.querySelector("img");
      image.src = SkillsStore.resolveMediaUrl(item.image);
      image.alt = item.title;
      card.querySelector("h3").textContent = item.title;
      card.querySelector(".delete-link").dataset.id = item.id;
      fragment.append(card);
    });
    gallery.append(fragment);
  }

  function setMessage(text) {
    message.textContent = text;
  }

  function renderVoterList() {
    const groups = SkillsStore.loadGroups();
    const votes = SkillsStore.loadVotes();
    const voters = Object.values(votes.voters || {}).sort((a, b) => {
      return (a.label || "").localeCompare(b.label || "");
    });

    voterList.replaceChildren();

    if (voters.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Ingen har stemt endnu.";
      voterList.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    voters.forEach((voter) => {
      const row = document.createElement("div");
      row.className = "voter-row";

      const name = document.createElement("strong");
      name.textContent = voter.label || "Ukendt v\u00e6lger";

      const choices = SkillsStore.audienceCategories
        .map((category) => {
          const groupId = voter.choices?.[category.id];
          const group = groups.find((item) => item.id === groupId);
          return group ? `${category.label}: ${group.title}` : "";
        })
        .filter(Boolean);

      const summary = document.createElement("span");
      summary.textContent = choices.length > 0 ? choices.join(" | ") : "Har ikke valgt endnu";

      row.append(name, summary);
      fragment.append(row);
    });

    voterList.append(fragment);
  }

  function emptyState(title, text) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<div><strong>${title}</strong><span>${text}</span></div>`;
    return empty;
  }
})();
