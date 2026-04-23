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
  datasets: {},
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
  questionHint: document.getElementById("quiz-question-hint"),
  options: document.getElementById("quiz-options"),
  answerFeedback: document.getElementById("quiz-answer-feedback"),
  prevBtn: document.getElementById("quiz-prev-btn"),
  nextBtn: document.getElementById("quiz-next-btn"),
  checkAnswerBtn: document.getElementById("quiz-check-btn"),
  submitBtn: document.getElementById("quiz-submit-btn"),
  score: document.getElementById("quiz-score"),
};

const questionBankElements = {
  searchInput: document.getElementById("question-bank-search"),
  count: document.getElementById("question-bank-count"),
  list: document.getElementById("question-bank-list"),
  empty: document.getElementById("question-bank-empty"),
};

const QUIZ_OPTION_KEYS = ["A", "B", "C", "D", "E"];

function parseAnswerKeys(value) {
  const rawValue = String(value || "")
    .toUpperCase()
    .replace(/\.$/, "")
    .trim();
  const answerParts = rawValue.includes(",")
    ? rawValue.split(",")
    : /^[A-E]+$/.test(rawValue)
      ? rawValue.split("")
      : [rawValue];

  return answerParts
    .map((item) => item.trim())
    .filter(
      (item, index, items) =>
        /^[A-E]$/.test(item) && items.indexOf(item) === index,
    );
}

function getQuestionAnswerKeys(question) {
  if (!question) return [];
  if (Array.isArray(question.answerKeys)) return question.answerKeys;
  return parseAnswerKeys(question.answer);
}

function getSelectedAnswerKeys(value) {
  return Array.isArray(value) ? value : [];
}

function hasAnswerSelection(value) {
  return getSelectedAnswerKeys(value).length > 0;
}

function getQuestionOptionKeys(question) {
  return QUIZ_OPTION_KEYS.filter((key) =>
    Object.prototype.hasOwnProperty.call(question.options, key),
  );
}

function isMultipleAnswerQuestion(question) {
  return getQuestionAnswerKeys(question).length > 1;
}

function formatAnswerKeys(keys, options) {
  return keys
    .map((key) => (options[key] ? `${key}. ${options[key]}` : `${key}.`))
    .join(", ");
}

function isSelectionCorrect(question, selectedKeys) {
  const correctKeys = getQuestionAnswerKeys(question);
  const pickedKeys = getSelectedAnswerKeys(selectedKeys);

  return (
    correctKeys.length === pickedKeys.length &&
    correctKeys.every((key) => pickedKeys.includes(key))
  );
}

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

      if (
        /^[A-E](?:\.\s*|:\s*|\s+)/.test(current) ||
        /^\*?\s*\d+\.\s+/.test(current)
      ) {
        break;
      }

      question += ` ${current}`;
      i += 1;
    }

    const options = {};

    while (i < lines.length) {
      const current = lines[i].trim();
      if (!current) {
        i += 1;
        continue;
      }

      if (/^[A-E](?:\s*,\s*[A-E])*\.?$/i.test(current)) break;

      const optionMatch = current.match(/^([A-E])(?:\.\s*|:\s*|\s+)(.*)$/);
      if (!optionMatch) break;

      options[optionMatch[1]] = optionMatch[2].trim();
      i += 1;
    }

    while (i < lines.length && !lines[i].trim()) {
      i += 1;
    }

    let answerKeys = [];

    if (i < lines.length) {
      answerKeys = parseAnswerKeys(lines[i].trim().replace(/\.$/, ""));
      if (answerKeys.length) {
        i += 1;
      }
    }

    if (question && Object.keys(options).length > 0 && answerKeys.length) {
      questions.push({
        number,
        question,
        options,
        answer: answerKeys.join(","),
        answerKeys,
      });
    }
  }

  return questions.sort((a, b) => a.number - b.number);
}

function buildQuizDatasets(questions) {
  return {
    all: {
      key: "all",
      label: "Bộ tổng hợp",
      questions,
    },
    quiz1: {
      key: "quiz1",
      label: "Quiz 1",
      questions: questions.filter(
        (question) => question.number >= 1 && question.number <= 99,
      ),
    },
    quiz2: {
      key: "quiz2",
      label: "Quiz 2",
      questions: questions.filter(
        (question) => question.number >= 100 && question.number <= 177,
      ),
    },
  };
}

function shuffleArray(input) {
  const clone = [...input];

  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }

  return clone;
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getQuestionSearchText(question) {
  const optionsText = Object.entries(question.options)
    .map(([key, text]) => `${key} ${text}`)
    .join(" ");

  return normalizeSearchText(
    `${question.number} ${question.question} ${getQuestionAnswerKeys(question).join(" ")} ${optionsText}`,
  );
}

function getCorrectAnswerLabel(question) {
  return formatAnswerKeys(getQuestionAnswerKeys(question), question.options);
}

function getSelectedMode() {
  const selected = document.querySelector('input[name="quiz-mode"]:checked');
  return selected ? selected.value : "random25";
}

function updateQuestionHint(question) {
  if (!quizElements.questionHint) return;

  if (!question || !isMultipleAnswerQuestion(question)) {
    quizElements.questionHint.hidden = true;
    quizElements.questionHint.textContent = "";
    return;
  }

  const answerCount = getQuestionAnswerKeys(question).length;
  quizElements.questionHint.hidden = false;
  quizElements.questionHint.textContent = `Chọn ${answerCount} đáp án`;
}

function resetQuizSession() {
  quizState.activeQuestions = [];
  quizState.answers = [];
  quizState.revealed = [];
  quizState.currentIndex = 0;

  quizElements.playground.hidden = true;
  quizElements.progress.textContent = "";
  quizElements.questionId.textContent = "";
  quizElements.questionText.textContent = "";
  quizElements.options.innerHTML = "";
  quizElements.answerFeedback.textContent = "";
  quizElements.score.textContent = "";
  updateQuestionHint(null);
  updateCheckAnswerButton(null);
}

function updateLoadStatus() {
  const total = quizState.datasets.all?.questions.length || 0;
  const quiz1 = quizState.datasets.quiz1?.questions.length || 0;
  const quiz2 = quizState.datasets.quiz2?.questions.length || 0;

  quizElements.loadStatus.textContent =
    `Đã nạp ${total} câu hỏi. Quiz 1 có ${quiz1} câu, Quiz 2 có ${quiz2} câu.`;
}

function getQuestionsForMode(mode) {
  if (mode === "quiz1") {
    return [...(quizState.datasets.quiz1?.questions || [])];
  }

  if (mode === "quiz2") {
    return [...(quizState.datasets.quiz2?.questions || [])];
  }

  return [...(quizState.datasets.all?.questions || [])];
}

function isQuestionAnswered(question, index) {
  if (!question) return false;

  if (isMultipleAnswerQuestion(question)) {
    return Boolean(quizState.revealed[index]);
  }

  return hasAnswerSelection(quizState.answers[index]);
}

function updateNavButtons() {
  const { currentIndex, activeQuestions } = quizState;
  quizElements.prevBtn.disabled = currentIndex === 0;
  quizElements.nextBtn.disabled = currentIndex >= activeQuestions.length - 1;
}

function updateProgress() {
  const total = quizState.activeQuestions.length;
  if (!total) {
    quizElements.progress.textContent = "";
    return;
  }

  const current = quizState.currentIndex + 1;
  const answeredCount = quizState.activeQuestions.filter((question, index) =>
    isQuestionAnswered(question, index),
  ).length;

  quizElements.progress.textContent = `Câu ${current}/${total} - Đã trả lời ${answeredCount}/${total}`;
}

function updateFeedback() {
  const question = quizState.activeQuestions[quizState.currentIndex];

  if (!question) {
    quizElements.answerFeedback.textContent = "";
    return;
  }

  const selectedKeys = getSelectedAnswerKeys(
    quizState.answers[quizState.currentIndex],
  );
  const revealed = quizState.revealed[quizState.currentIndex];
  const requiredAnswerCount = getQuestionAnswerKeys(question).length;
  const correctLabel = getCorrectAnswerLabel(question);

  if (!revealed) {
    if (isMultipleAnswerQuestion(question)) {
      if (!selectedKeys.length) {
        quizElements.answerFeedback.textContent =
          'Chọn đủ đáp án rồi bấm "Nộp đáp án" để kiểm tra.';
      } else if (selectedKeys.length < requiredAnswerCount) {
        quizElements.answerFeedback.textContent = `Đã chọn ${selectedKeys.length}/${requiredAnswerCount} đáp án.`;
      } else {
        quizElements.answerFeedback.textContent =
          'Đã chọn đủ đáp án. Bấm "Nộp đáp án" để kiểm tra.';
      }
    } else {
      quizElements.answerFeedback.textContent =
        "Chọn 1 đáp án, hệ thống sẽ chấm đúng/sai ngay.";
    }
    return;
  }

  if (!selectedKeys.length) {
    quizElements.answerFeedback.textContent =
      "Đáp án đúng là " + correctLabel + ".";
    return;
  }

  const selectedLabel = formatAnswerKeys(selectedKeys, question.options);
  quizElements.answerFeedback.textContent = isSelectionCorrect(
    question,
    selectedKeys,
  )
    ? "Chính xác. Đáp án đúng là " + correctLabel + "."
    : "Chưa đúng. Bạn chọn " +
      selectedLabel +
      ". Đáp án đúng là " +
      correctLabel +
      ".";
}

function updateCheckAnswerButton(question) {
  if (!quizElements.checkAnswerBtn) return;

  if (!question || !isMultipleAnswerQuestion(question)) {
    quizElements.checkAnswerBtn.hidden = true;
    quizElements.checkAnswerBtn.disabled = true;
    quizElements.checkAnswerBtn.textContent = "Nộp đáp án";
    return;
  }

  const selectedKeys = getSelectedAnswerKeys(
    quizState.answers[quizState.currentIndex],
  );
  const requiredAnswerCount = getQuestionAnswerKeys(question).length;
  const revealed = quizState.revealed[quizState.currentIndex];

  quizElements.checkAnswerBtn.hidden = false;
  quizElements.checkAnswerBtn.disabled =
    revealed || selectedKeys.length !== requiredAnswerCount;
  quizElements.checkAnswerBtn.textContent = revealed
    ? "Đã nộp đáp án"
    : "Nộp đáp án";
}

function renderOptions(question) {
  const selectedKeys = getSelectedAnswerKeys(
    quizState.answers[quizState.currentIndex],
  );
  const revealed = quizState.revealed[quizState.currentIndex];
  const answerKeys = getQuestionAnswerKeys(question);
  const isMultipleAnswer = isMultipleAnswerQuestion(question);

  quizElements.options.innerHTML = "";

  getQuestionOptionKeys(question).forEach((key) => {
    const optionText = question.options[key];

    const optionButton = document.createElement("button");
    optionButton.type = "button";
    optionButton.className = "quiz-option";
    optionButton.dataset.option = key;
    optionButton.textContent = key + ". " + optionText;
    optionButton.disabled = revealed;
    optionButton.setAttribute(
      "aria-pressed",
      String(selectedKeys.includes(key)),
    );

    if (selectedKeys.includes(key)) {
      optionButton.classList.add("selected");
    }

    if (revealed) {
      if (answerKeys.includes(key)) {
        optionButton.classList.add("correct");
      } else if (selectedKeys.includes(key)) {
        optionButton.classList.add("incorrect");
      }
    }

    optionButton.addEventListener("click", () => {
      if (quizState.revealed[quizState.currentIndex]) return;

      let nextSelection = [];

      if (isMultipleAnswer) {
        if (selectedKeys.includes(key)) {
          nextSelection = selectedKeys.filter((item) => item !== key);
        } else {
          if (selectedKeys.length >= answerKeys.length) return;
          nextSelection = [...selectedKeys, key].sort();
        }
      } else {
        nextSelection = [key];
      }

      quizState.answers[quizState.currentIndex] = nextSelection;
      quizState.revealed[quizState.currentIndex] =
        !isMultipleAnswer && hasAnswerSelection(nextSelection);

      renderCurrentQuestion();
    });

    quizElements.options.appendChild(optionButton);
  });
}

function renderCurrentQuestion() {
  const question = quizState.activeQuestions[quizState.currentIndex];
  if (!question) return;

  quizElements.questionId.textContent = `Câu gốc #${question.number}`;
  quizElements.questionText.textContent = question.question;
  updateQuestionHint(question);
  renderOptions(question);
  updateProgress();
  updateNavButtons();
  updateFeedback();
  updateCheckAnswerButton(question);
}

function startQuiz() {
  const mode = getSelectedMode();
  const sourceQuestions = getQuestionsForMode(mode);

  if (!sourceQuestions.length) {
    quizElements.loadStatus.textContent =
      "Không có dữ liệu câu hỏi để bắt đầu.";
    return;
  }

  quizState.activeQuestions =
    mode === "random25"
      ? shuffleArray(sourceQuestions).slice(
          0,
          Math.min(25, sourceQuestions.length),
        )
      : sourceQuestions;
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

function submitCurrentAnswer() {
  const question = quizState.activeQuestions[quizState.currentIndex];
  if (!question || !isMultipleAnswerQuestion(question)) return;

  const selectedKeys = getSelectedAnswerKeys(
    quizState.answers[quizState.currentIndex],
  );
  const requiredAnswerCount = getQuestionAnswerKeys(question).length;

  if (selectedKeys.length !== requiredAnswerCount) return;

  quizState.revealed[quizState.currentIndex] = true;
  renderCurrentQuestion();
}

function submitQuiz() {
  const total = quizState.activeQuestions.length;
  if (!total) return;

  let answered = 0;
  let correct = 0;

  quizState.activeQuestions.forEach((question, index) => {
    const selectedKeys = getSelectedAnswerKeys(quizState.answers[index]);
    const requiredAnswerCount = getQuestionAnswerKeys(question).length;
    const canEvaluate =
      selectedKeys.length > 0 &&
      (!isMultipleAnswerQuestion(question) ||
        selectedKeys.length === requiredAnswerCount);

    if (canEvaluate) {
      quizState.revealed[index] = true;
      answered += 1;
    }

    if (canEvaluate && isSelectionCorrect(question, selectedKeys)) {
      correct += 1;
    }
  });

  quizElements.score.textContent = `Kết quả: đúng ${correct}/${total} câu - đã trả lời ${answered}/${total} câu.`;

  if (!quizElements.playground.hidden) {
    renderCurrentQuestion();
  }
}

function renderQuestionBank(questions) {
  if (
    !questionBankElements.list ||
    !questionBankElements.empty ||
    !questionBankElements.count
  ) {
    return;
  }

  questionBankElements.list.innerHTML = "";
  questionBankElements.empty.hidden = questions.length > 0;
  questionBankElements.count.textContent = `Hiển thị ${questions.length}/${quizState.allQuestions.length} câu`;

  if (!questions.length) {
    return;
  }

  const fragment = document.createDocumentFragment();

  questions.forEach((question) => {
    const card = document.createElement("article");
    card.className = "question-bank-card";

    const meta = document.createElement("div");
    meta.className = "question-bank-card__meta";

    const id = document.createElement("p");
    id.className = "question-bank-card__id";
    id.textContent = `Câu #${question.number}`;

    const answer = document.createElement("p");
    answer.className = "question-bank-card__answer";
    answer.textContent = `Đáp án đúng: ${getCorrectAnswerLabel(question)}`;

    meta.append(id, answer);

    const title = document.createElement("h4");
    title.className = "question-bank-card__question";
    title.textContent = question.question;

    const options = document.createElement("div");
    options.className = "question-bank-options";

    getQuestionOptionKeys(question).forEach((key) => {
      const optionText = question.options[key];

      const option = document.createElement("div");
      option.className = "question-bank-option";

      if (getQuestionAnswerKeys(question).includes(key)) {
        option.classList.add("correct");
      }

      const label = document.createElement("strong");
      label.textContent = key + ". ";
      option.appendChild(label);
      option.append(optionText);
      options.appendChild(option);
    });

    card.append(meta, title, options);
    fragment.appendChild(card);
  });

  questionBankElements.list.appendChild(fragment);
}

function filterQuestionBank() {
  const keyword = normalizeSearchText(questionBankElements.searchInput?.value);

  if (!keyword) {
    renderQuestionBank(quizState.allQuestions);
    return;
  }

  const filteredQuestions = quizState.allQuestions.filter((question) =>
    getQuestionSearchText(question).includes(keyword),
  );

  renderQuestionBank(filteredQuestions);
}

function initQuestionBank() {
  if (
    !questionBankElements.searchInput ||
    !questionBankElements.count ||
    !questionBankElements.list ||
    !questionBankElements.empty
  ) {
    return;
  }

  questionBankElements.searchInput.addEventListener(
    "input",
    filterQuestionBank,
  );
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
  const parsedQuestions = parseQuestionBank(raw);

  if (!parsedQuestions.length) {
    quizElements.loadStatus.textContent =
      "Không đọc được bộ câu hỏi từ quiz-data.js. Vui lòng kiểm tra file dữ liệu.";
    quizElements.startBtn.disabled = true;
    if (questionBankElements.count) {
      questionBankElements.count.textContent =
        "Không tải được dữ liệu câu hỏi.";
    }
    if (questionBankElements.empty) {
      questionBankElements.empty.hidden = false;
      questionBankElements.empty.textContent =
        "Không đọc được bộ câu hỏi hiện tại.";
    }
    return;
  }

  quizState.datasets = buildQuizDatasets(parsedQuestions);
  quizState.allQuestions = [...quizState.datasets.all.questions];
  updateLoadStatus();

  quizElements.startBtn.addEventListener("click", startQuiz);
  quizElements.prevBtn.addEventListener("click", () => moveQuestion(-1));
  quizElements.nextBtn.addEventListener("click", () => moveQuestion(1));
  quizElements.checkAnswerBtn?.addEventListener("click", submitCurrentAnswer);
  quizElements.submitBtn.addEventListener("click", submitQuiz);

  initQuestionBank();
  renderQuestionBank(quizState.allQuestions);
}
function getTocGroupLabel(id) {
  if (id === "#nhap-mon") return "Chương nhập môn";
  if (id.startsWith("#c1-")) return "Chương 1";
  if (id.startsWith("#c2-")) return "Chương 2";
  if (id.startsWith("#c3-")) return "Chương 3";
  return "Mục khác";
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

  const groupOrder = ["Chương nhập môn", "Chương 1", "Chương 2", "Chương 3"];
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
      `<span class="sidebar-toc-group__count">${entries.length} mục</span>`;

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
