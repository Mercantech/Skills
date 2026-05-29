(async function () {
  await SkillsStore.ready();

  const board = document.querySelector("#scoreboard");
  const template = document.querySelector("#score-row-template");
  const chart = document.querySelector("#leader-chart-bars");
  const barTemplate = document.querySelector("#leader-bar-template");
  const winnerName = document.querySelector("#winner-name");

  render();

  function render() {
    const groups = SkillsStore.loadGroups();
    const votes = SkillsStore.loadVotes();
    const scores = SkillsStore.calculateScores(groups, votes);
    const max = Math.max(1, ...scores.map((item) => item.total));

    board.replaceChildren();
    chart.replaceChildren();
    winnerName.textContent = scores[0]?.title || "-";

    if (scores.length === 0) {
      chart.append(emptyState("Ingen chart endnu", "Der mangler grupper og point."));
      board.append(emptyState("Ingen point endnu", "Tilf\u00f8j grupper og udfyld tjeklisten f\u00f8rst."));
      return;
    }

    renderChart(scores, max);

    const fragment = document.createDocumentFragment();
    scores.forEach((score, index) => {
      const row = template.content.firstElementChild.cloneNode(true);
      row.querySelector(".rank").textContent = `#${index + 1}`;
      row.querySelector("h3").textContent = score.title;
      row.querySelector(".owner").textContent = score.owner || "Elevspil";
      row.querySelector(".split-points").textContent = `Tjekliste: ${score.checklist} | Publikum: ${score.audience}`;
      row.querySelector(".score-total strong").textContent = String(score.total);

      const meta = row.querySelector(".score-meta");
      SkillsStore.audienceCategories.forEach((category) => {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = `${category.label}: ${SkillsStore.getVoteCount(votes, category.id, score.id)}`;
        meta.append(tag);
      });

      fragment.append(row);
    });
    board.append(fragment);
  }

  function renderChart(scores, max) {
    const fragment = document.createDocumentFragment();

    scores.forEach((score) => {
      const bar = barTemplate.content.firstElementChild.cloneNode(true);
      bar.querySelector("strong").textContent = score.title;
      bar.querySelector("span").textContent = score.owner || "Elevspil";
      bar.querySelector(".bar-fill").style.width = `${Math.round((score.total / max) * 100)}%`;
      bar.querySelector(".bar-value").textContent = String(score.total);
      fragment.append(bar);
    });

    chart.append(fragment);
  }

  function emptyState(title, text) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<div><strong>${title}</strong><span>${text}</span></div>`;
    return empty;
  }
})();
