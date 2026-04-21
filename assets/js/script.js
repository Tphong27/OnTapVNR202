const menuButtons = Array.from(document.querySelectorAll(".feature-link"));
const panels = Array.from(document.querySelectorAll(".feature-panel"));
const studyPanelId = "panel-bai-giang";
const mobileLayoutQuery = window.matchMedia("(max-width: 900px)");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

function addMediaListener(query, handler) {
  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", handler);
    return;
  }

  if (typeof query.addListener === "function") {
    query.addListener(handler);
  }
}

function isMobileLayout() {
  return mobileLayoutQuery.matches;
}

function getScrollBehavior() {
  return reducedMotionQuery.matches ? "auto" : "smooth";
}

function getStudyPanel() {
  return document.getElementById(studyPanelId);
}

let closeMobileSidebar = () => {};
let openMobileSidebar = () => {};
let syncStudyToc = () => {};
let openMobileStudyNav = () => {};
let updateStudyEntryPoints = () => {};

function activatePanel(targetId) {
  let nextPanel = null;

  menuButtons.forEach((button) => {
    const isActive = button.dataset.target === targetId;
    button.classList.toggle("active", isActive);
  });

  panels.forEach((panel) => {
    const isActive = panel.id === targetId;
    panel.classList.toggle("active", isActive);

    if (isActive) {
      nextPanel = panel;
    }
  });

  updateStudyEntryPoints();
  return nextPanel;
}

menuButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const targetId = button.dataset.target;
    if (!targetId) return;

    const targetPanel = activatePanel(targetId);
    if (!targetPanel) return;

    window.scrollTo({ top: 0, behavior: getScrollBehavior() });
    closeMobileSidebar();
    syncStudyToc();
  });
});

function initMobileSidebar() {
  const body = document.body;
  const sidebar = document.getElementById("app-sidebar");
  const openButton = document.querySelector(".mobile-menu-toggle");
  const closeButton = document.querySelector(".sidebar-close");
  const backdrop = document.querySelector(".mobile-sidebar-backdrop");
  const tocShortcut = document.querySelector(".mobile-toc-shortcut");

  if (!sidebar || !openButton || !backdrop) return;

  const setSidebarOpen = (nextOpen) => {
    const isOpen = isMobileLayout() && nextOpen;

    body.classList.toggle("sidebar-open", isOpen);
    openButton.setAttribute("aria-expanded", String(isOpen));
    backdrop.hidden = !isOpen;
  };

  closeMobileSidebar = () => setSidebarOpen(false);
  openMobileSidebar = () => setSidebarOpen(true);

  openButton.addEventListener("click", () => {
    setSidebarOpen(!body.classList.contains("sidebar-open"));
  });

  closeButton?.addEventListener("click", closeMobileSidebar);
  backdrop.addEventListener("click", closeMobileSidebar);

  tocShortcut?.addEventListener("click", () => {
    openMobileStudyNav();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMobileSidebar();
    }
  });

  addMediaListener(mobileLayoutQuery, () => {
    closeMobileSidebar();
    updateStudyEntryPoints();
  });
}

const quizState = {
  allQuestions: [],
  activeQuestions: [],
  answers: [],
  revealed: [],
  currentIndex: 0,
};

const quizElements = {
  startBtn: document.getElementById("quiz-start-btn"),
  loadStatus: document.getElementById("quiz-load-status"),
  playground: document.getElementById("quiz-playground"),
  progress: document.getElementById("quiz-progress"),
  questionId: document.getElementById("quiz-question-id"),
  questionText: document.getElementById("quiz-question-text"),
  options: document.getElementById("quiz-options"),
  answerFeedback: document.getElementById("quiz-answer-feedback"),
  prevBtn: document.getElementById("quiz-prev-btn"),
  nextBtn: document.getElementById("quiz-next-btn"),
  submitBtn: document.getElementById("quiz-submit-btn"),
  score: document.getElementById("quiz-score"),
};

function parseQuestionBank(rawText) {
  const lines = rawText.replace(/\r/g, "").split("\n");
  const questions = [];
  let i = 0;

  while (i < lines.length) {
    const startLine = lines[i].trim();
    const startMatch = startLine.match(/^\*?\s*(\d+)\.\s*(.+)$/);

    if (!startMatch) {
      i += 1;
      continue;
    }

    const number = Number(startMatch[1]);
    let question = startMatch[2].trim();
    i += 1;

    while (i < lines.length) {
      const current = lines[i].trim();

      if (!current) {
        i += 1;
        continue;
      }

      if (/^[A-D]\.\s*/.test(current) || /^\*?\s*\d+\.\s+/.test(current)) {
        break;
      }

      question += ` ${current}`;
      i += 1;
    }

    const options = {};

    while (i < lines.length) {
      const current = lines[i].trim();
      if (/^[A-D](?:\.)?$/i.test(current)) break;

      const optionMatch = current.match(/^([A-D])\.\s*(.*)$/);
      if (!optionMatch) break;

      options[optionMatch[1]] = optionMatch[2].trim();
      i += 1;
    }

    while (i < lines.length && !lines[i].trim()) {
      i += 1;
    }

    let answer = "";

    if (i < lines.length) {
      const answerMatch = lines[i].trim().match(/^([A-D])(?:\.)?$/i);
      if (answerMatch) {
        answer = answerMatch[1].toUpperCase();
        i += 1;
      }
    }

    if (question && Object.keys(options).length > 0 && answer) {
      questions.push({ number, question, options, answer });
    }
  }

  return questions.sort((a, b) => a.number - b.number);
}

function shuffleArray(input) {
  const clone = [...input];

  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }

  return clone;
}

function getSelectedMode() {
  const selected = document.querySelector('input[name="quiz-mode"]:checked');
  return selected ? selected.value : "random25";
}

function updateNavButtons() {
  const { currentIndex, activeQuestions } = quizState;
  quizElements.prevBtn.disabled = currentIndex === 0;
  quizElements.nextBtn.disabled = currentIndex >= activeQuestions.length - 1;
}

function updateProgress() {
  const total = quizState.activeQuestions.length;
  const current = quizState.currentIndex + 1;
  const answeredCount = quizState.answers.filter(Boolean).length;

  quizElements.progress.textContent =
    `Cau ${current}/${total} - Da tra loi ${answeredCount}/${total}`;
}

function updateFeedback() {
  const question = quizState.activeQuestions[quizState.currentIndex];
  const selected = quizState.answers[quizState.currentIndex];
  const revealed = quizState.revealed[quizState.currentIndex];

  if (!question) {
    quizElements.answerFeedback.textContent = "";
    return;
  }

  if (!revealed) {
    quizElements.answerFeedback.textContent =
      "Chon dap an de xem ket qua ngay tren cau hien tai.";
    return;
  }

  if (!selected) {
    quizElements.answerFeedback.textContent = `Dap an dung la ${question.answer}.`;
    return;
  }

  quizElements.answerFeedback.textContent =
    selected === question.answer
      ? `Chinh xac. Dap an dung la ${question.answer}.`
      : `Chua dung. Ban chon ${selected}, dap an dung la ${question.answer}.`;
}

function renderOptions(question) {
  const selected = quizState.answers[quizState.currentIndex];
  const revealed = quizState.revealed[quizState.currentIndex];

  quizElements.options.innerHTML = "";

  ["A", "B", "C", "D"].forEach((key) => {
    if (!question.options[key]) return;

    const optionButton = document.createElement("button");
    optionButton.type = "button";
    optionButton.className = "quiz-option";
    optionButton.dataset.option = key;
    optionButton.textContent = `${key}. ${question.options[key]}`;
    optionButton.disabled = revealed;

    if (selected === key) {
      optionButton.classList.add("selected");
    }

    if (revealed) {
      if (key === question.answer) {
        optionButton.classList.add("correct");
      } else if (selected === key) {
        optionButton.classList.add("incorrect");
      }
    }

    optionButton.addEventListener("click", () => {
      if (quizState.revealed[quizState.currentIndex]) return;

      quizState.answers[quizState.currentIndex] = key;
      quizState.revealed[quizState.currentIndex] = true;
      renderCurrentQuestion();
    });

    quizElements.options.appendChild(optionButton);
  });
}

function renderCurrentQuestion() {
  const question = quizState.activeQuestions[quizState.currentIndex];
  if (!question) return;

  quizElements.questionId.textContent = `Cau goc #${question.number}`;
  quizElements.questionText.textContent = question.question;

  renderOptions(question);
  updateProgress();
  updateNavButtons();
  updateFeedback();
}

function startQuiz() {
  const mode = getSelectedMode();
  const allQuestions = [...quizState.allQuestions];

  if (!allQuestions.length) {
    quizElements.loadStatus.textContent = "Khong co du lieu cau hoi de bat dau.";
    return;
  }

  quizState.activeQuestions =
    mode === "random25" ? shuffleArray(allQuestions).slice(0, 25) : allQuestions;
  quizState.answers = new Array(quizState.activeQuestions.length).fill(null);
  quizState.revealed = new Array(quizState.activeQuestions.length).fill(false);
  quizState.currentIndex = 0;

  quizElements.score.textContent = "";
  quizElements.playground.hidden = false;
  renderCurrentQuestion();
}

function moveQuestion(step) {
  const nextIndex = quizState.currentIndex + step;
  if (nextIndex < 0 || nextIndex >= quizState.activeQuestions.length) return;

  quizState.currentIndex = nextIndex;
  renderCurrentQuestion();
}

function submitQuiz() {
  const total = quizState.activeQuestions.length;
  const answered = quizState.answers.filter(Boolean).length;
  let correct = 0;

  quizState.activeQuestions.forEach((question, index) => {
    if (quizState.answers[index] === question.answer) {
      correct += 1;
    }
  });

  quizElements.score.textContent =
    `Ket qua: dung ${correct}/${total} cau - da tra loi ${answered}/${total} cau.`;
}

function initQuiz() {
  if (
    !quizElements.startBtn ||
    !quizElements.loadStatus ||
    !quizElements.playground
  ) {
    return;
  }

  const raw = typeof window.QUIZ_RAW === "string" ? window.QUIZ_RAW : "";
  quizState.allQuestions = parseQuestionBank(raw);

  if (!quizState.allQuestions.length) {
    quizElements.loadStatus.textContent =
      "Khong doc duoc bo cau hoi tu pt.txt. Vui long kiem tra file du lieu.";
    quizElements.startBtn.disabled = true;
    return;
  }

  quizElements.loadStatus.textContent =
    `Da nap ${quizState.allQuestions.length} cau hoi.`;

  const legacyCheckButton = document.getElementById("quiz-check-btn");
  if (legacyCheckButton) {
    legacyCheckButton.hidden = true;
  }

  quizElements.startBtn.addEventListener("click", startQuiz);
  quizElements.prevBtn.addEventListener("click", () => moveQuestion(-1));
  quizElements.nextBtn.addEventListener("click", () => moveQuestion(1));
  quizElements.submitBtn.addEventListener("click", submitQuiz);
}

function getTocGroupLabel(id) {
  if (id === "#nhap-mon") return "Chuong nhap mon";
  if (id.startsWith("#c1-")) return "Chuong 1";
  if (id.startsWith("#c2-")) return "Chuong 2";
  if (id.startsWith("#c3-")) return "Chuong 3";
  return "Muc khac";
}

function initStudyToc() {
  const studyPanel = getStudyPanel();
  const desktopTocLinks = Array.from(
    document.querySelectorAll('#panel-bai-giang .toc a[href^="#"]'),
  );
  const mobileNavRoot = document.getElementById("mobile-study-nav");
  const mobileNavSection = document.querySelector(".sidebar-study-nav");
  const tocShortcut = document.querySelector(".mobile-toc-shortcut");

  if (!studyPanel || !desktopTocLinks.length || !mobileNavRoot || !mobileNavSection) {
    updateStudyEntryPoints = () => {};
    return;
  }

  const trackedSections = desktopTocLinks
    .map((link) => {
      const id = link.getAttribute("href");
      const section = id ? document.querySelector(id) : null;

      if (!id || !section) return null;

      return {
        id,
        label: link.textContent.trim(),
        link,
        section,
        group: getTocGroupLabel(id),
      };
    })
    .filter(Boolean);

  if (!trackedSections.length) {
    updateStudyEntryPoints = () => {};
    return;
  }

  const groupOrder = ["Chuong nhap mon", "Chuong 1", "Chuong 2", "Chuong 3"];
  const groupedEntries = groupOrder
    .map((group) => ({
      group,
      entries: trackedSections.filter((entry) => entry.group === group),
    }))
    .filter((group) => group.entries.length > 0);

  const mobileLinkMap = new Map();
  const mobileGroupMap = new Map();
  const desktopLinkMap = new Map(
    trackedSections.map((entry) => [entry.id, entry.link]),
  );

  let activeId = trackedSections[0].id;

  function closeAllMobileGroups() {
    mobileGroupMap.forEach((groupElement) => {
      groupElement.classList.remove("is-open");
    });
  }

  function openMobileGroupFor(id) {
    const currentEntry = trackedSections.find((entry) => entry.id === id);
    if (!currentEntry) return;

    closeAllMobileGroups();
    const targetGroup = mobileGroupMap.get(currentEntry.group);
    targetGroup?.classList.add("is-open");
  }

  function keepActiveLinkVisible(id) {
    if (isMobileLayout()) {
      const mobileLink = mobileLinkMap.get(id);
      mobileLink?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: getScrollBehavior(),
      });
      return;
    }

    const desktopLink = desktopLinkMap.get(id);
    desktopLink?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: getScrollBehavior(),
    });
  }

  function setActiveLink(nextActiveId) {
    trackedSections.forEach(({ id, link }) => {
      link.classList.toggle("active", id === nextActiveId);
    });

    mobileLinkMap.forEach((link, id) => {
      link.classList.toggle("active", id === nextActiveId);
    });
  }

  function updateActiveSection() {
    const viewportAnchor = isMobileLayout() ? 110 : window.innerHeight * 0.24;
    let current = trackedSections[0];

    trackedSections.forEach((entry) => {
      if (entry.section.getBoundingClientRect().top <= viewportAnchor) {
        current = entry;
      }
    });

    if (!current || current.id === activeId) return;

    activeId = current.id;
    setActiveLink(activeId);

    if (!isMobileLayout()) {
      keepActiveLinkVisible(activeId);
    }
  }

  function navigateToSection(id, shouldCloseSidebar) {
    const targetEntry = trackedSections.find((entry) => entry.id === id);
    if (!targetEntry) return;

    activeId = id;
    setActiveLink(id);
    openMobileGroupFor(id);
    keepActiveLinkVisible(id);
    targetEntry.section.scrollIntoView({
      behavior: getScrollBehavior(),
      block: "start",
    });

    if (history.replaceState) {
      history.replaceState(null, "", id);
    } else {
      window.location.hash = id;
    }

    if (shouldCloseSidebar) {
      closeMobileSidebar();
    }
  }

  groupedEntries.forEach(({ group, entries }) => {
    const groupElement = document.createElement("section");
    groupElement.className = "sidebar-toc-group";

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "sidebar-toc-group__toggle";
    toggleButton.setAttribute("aria-expanded", "false");
    toggleButton.innerHTML =
      `<span class="sidebar-toc-group__title">${group}</span>` +
      `<span class="sidebar-toc-group__count">${entries.length} muc</span>`;

    const linksWrap = document.createElement("div");
    linksWrap.className = "sidebar-toc-group__links";

    toggleButton.addEventListener("click", () => {
      const isOpen = groupElement.classList.contains("is-open");
      closeAllMobileGroups();
      groupElement.classList.toggle("is-open", !isOpen);

      mobileGroupMap.forEach((item) => {
        const isItemOpen = item.classList.contains("is-open");
        const button = item.querySelector(".sidebar-toc-group__toggle");
        button?.setAttribute("aria-expanded", String(isItemOpen));
      });
    });

    entries.forEach((entry) => {
      const link = document.createElement("a");
      link.className = "sidebar-toc-link";
      link.href = entry.id;
      link.textContent = entry.label;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        navigateToSection(entry.id, true);
      });

      mobileLinkMap.set(entry.id, link);
      linksWrap.appendChild(link);
    });

    groupElement.append(toggleButton, linksWrap);
    mobileGroupMap.set(group, groupElement);
    mobileNavRoot.appendChild(groupElement);
  });

  desktopTocLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const id = link.getAttribute("href");
      if (!id) return;

      event.preventDefault();
      navigateToSection(id, false);
    });
  });

  updateStudyEntryPoints = () => {
    const isStudyActive = studyPanel.classList.contains("active");
    mobileNavSection.hidden = !isStudyActive || !isMobileLayout();

    if (tocShortcut) {
      tocShortcut.hidden = !isStudyActive || !isMobileLayout();
    }

    if (!isStudyActive) {
      closeAllMobileGroups();
    }
  };

  syncStudyToc = () => {
    updateActiveSection();

    if (!isMobileLayout()) {
      keepActiveLinkVisible(activeId);
      return;
    }

    closeAllMobileGroups();
  };

  openMobileStudyNav = () => {
    if (!isMobileLayout() || !studyPanel.classList.contains("active")) return;

    openMobileSidebar();
    updateActiveSection();
    openMobileGroupFor(activeId);
    keepActiveLinkVisible(activeId);

    mobileGroupMap.forEach((item) => {
      const isItemOpen = item.classList.contains("is-open");
      const button = item.querySelector(".sidebar-toc-group__toggle");
      button?.setAttribute("aria-expanded", String(isItemOpen));
    });
  };

  window.addEventListener("scroll", updateActiveSection, { passive: true });
  window.addEventListener("hashchange", updateActiveSection);

  addMediaListener(mobileLayoutQuery, () => {
    updateStudyEntryPoints();
    closeAllMobileGroups();
    updateActiveSection();
  });

  const initialHash = window.location.hash;
  if (initialHash && desktopLinkMap.has(initialHash)) {
    activeId = initialHash;
  }

  setActiveLink(activeId);
  updateActiveSection();
  updateStudyEntryPoints();
}

initMobileSidebar();
initQuiz();
initStudyToc();
