const menuButtons = document.querySelectorAll(".feature-link");
const panels = document.querySelectorAll(".feature-panel");

menuButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const targetId = button.dataset.target;
    if (!targetId) return;

    menuButtons.forEach((item) => item.classList.remove("active"));
    panels.forEach((panel) => panel.classList.remove("active"));

    button.classList.add("active");
    const targetPanel = document.getElementById(targetId);
    if (targetPanel) {
      targetPanel.classList.add("active");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
});

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
      if (/^[A-D]\.\s*/.test(current)) break;
      if (/^\*?\s*\d+\.\s+/.test(current)) break;
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

    while (i < lines.length && !lines[i].trim()) i += 1;

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
  quizElements.progress.textContent = `Câu ${current}/${total} • Đã trả lời ${answeredCount}/${total}`;
}

function updateFeedback() {
  const q = quizState.activeQuestions[quizState.currentIndex];
  const selected = quizState.answers[quizState.currentIndex];
  const revealed = quizState.revealed[quizState.currentIndex];

  if (!revealed) {
    quizElements.answerFeedback.textContent = selected
      ? "Đã lưu lựa chọn. Bạn có thể bấm Xem đáp án hoặc chuyển câu tiếp theo."
      : "Bạn có thể chọn đáp án hoặc bấm Tiếp theo để bỏ qua câu này.";
    return;
  }

  if (!selected) {
    quizElements.answerFeedback.textContent = `Đáp án đúng là ${q.answer}.`;
    return;
  }

  quizElements.answerFeedback.textContent =
    selected === q.answer
      ? `Chính xác. Đáp án đúng là ${q.answer}.`
      : `Chưa đúng. Bạn chọn ${selected}, đáp án đúng là ${q.answer}.`;
}

function renderOptions(question) {
  const selected = quizState.answers[quizState.currentIndex];
  const revealed = quizState.revealed[quizState.currentIndex];

  quizElements.options.innerHTML = "";

  ["A", "B", "C", "D"].forEach((key) => {
    if (!question.options[key]) return;

    const optionBtn = document.createElement("button");
    optionBtn.type = "button";
    optionBtn.className = "quiz-option";
    optionBtn.dataset.option = key;
    optionBtn.textContent = `${key}. ${question.options[key]}`;

    if (selected === key) optionBtn.classList.add("selected");

    if (revealed) {
      if (key === question.answer) {
        optionBtn.classList.add("correct");
      } else if (selected === key && selected !== question.answer) {
        optionBtn.classList.add("incorrect");
      }
    }

    optionBtn.addEventListener("click", () => {
      quizState.answers[quizState.currentIndex] = key;
      renderCurrentQuestion();
    });

    quizElements.options.appendChild(optionBtn);
  });
}

function renderCurrentQuestion() {
  const question = quizState.activeQuestions[quizState.currentIndex];
  if (!question) return;

  quizElements.questionId.textContent = `Câu gốc #${question.number}`;
  quizElements.questionText.textContent = question.question;

  renderOptions(question);
  updateProgress();
  updateNavButtons();
  updateFeedback();
}

function startQuiz() {
  const mode = getSelectedMode();
  const all = [...quizState.allQuestions];

  if (!all.length) {
    quizElements.loadStatus.textContent = "Không có dữ liệu câu hỏi để bắt đầu.";
    return;
  }

  quizState.activeQuestions =
    mode === "random25" ? shuffleArray(all).slice(0, 25) : all;
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

function revealAnswer() {
  quizState.revealed[quizState.currentIndex] = true;
  renderCurrentQuestion();
}

function submitQuiz() {
  const total = quizState.activeQuestions.length;
  const answered = quizState.answers.filter(Boolean).length;
  let correct = 0;

  quizState.activeQuestions.forEach((question, index) => {
    if (quizState.answers[index] === question.answer) correct += 1;
  });

  quizElements.score.textContent = `Kết quả: đúng ${correct}/${total} câu • đã trả lời ${answered}/${total} câu.`;
}

function initQuiz() {
  const raw = typeof window.QUIZ_RAW === "string" ? window.QUIZ_RAW : "";
  quizState.allQuestions = parseQuestionBank(raw);

  if (!quizState.allQuestions.length) {
    quizElements.loadStatus.textContent =
      "Không đọc được bộ câu hỏi từ pt.txt. Vui lòng kiểm tra file dữ liệu.";
    if (quizElements.startBtn) quizElements.startBtn.disabled = true;
    return;
  }

  quizElements.loadStatus.textContent = `Đã nạp ${quizState.allQuestions.length} câu hỏi.`;

  quizElements.startBtn.addEventListener("click", startQuiz);
  quizElements.prevBtn.addEventListener("click", () => moveQuestion(-1));
  quizElements.nextBtn.addEventListener("click", () => moveQuestion(1));
  quizElements.checkBtn.addEventListener("click", revealAnswer);
  quizElements.submitBtn.addEventListener("click", submitQuiz);
}

function updateFeedback() {
  const q = quizState.activeQuestions[quizState.currentIndex];
  const selected = quizState.answers[quizState.currentIndex];
  const revealed = quizState.revealed[quizState.currentIndex];

  if (!revealed) {
    quizElements.answerFeedback.textContent =
      "Bạn có thể chọn đáp án hoặc bấm Tiếp theo để bỏ qua câu này.";
    return;
  }

  if (!selected) {
    quizElements.answerFeedback.textContent = `Đáp án đúng là ${q.answer}.`;
    return;
  }

  quizElements.answerFeedback.textContent =
    selected === q.answer
      ? `Chính xác. Đáp án đúng là ${q.answer}.`
      : `Chưa đúng. Bạn chọn ${selected}, đáp án đúng là ${q.answer}.`;
}

function renderOptions(question) {
  const selected = quizState.answers[quizState.currentIndex];
  const revealed = quizState.revealed[quizState.currentIndex];

  quizElements.options.innerHTML = "";

  ["A", "B", "C", "D"].forEach((key) => {
    if (!question.options[key]) return;

    const optionBtn = document.createElement("button");
    optionBtn.type = "button";
    optionBtn.className = "quiz-option";
    optionBtn.dataset.option = key;
    optionBtn.textContent = `${key}. ${question.options[key]}`;
    optionBtn.disabled = revealed;

    if (selected === key) optionBtn.classList.add("selected");

    if (revealed) {
      if (key === question.answer) {
        optionBtn.classList.add("correct");
      } else if (selected === key && selected !== question.answer) {
        optionBtn.classList.add("incorrect");
      }
    }

    optionBtn.addEventListener("click", () => {
      if (quizState.revealed[quizState.currentIndex]) return;
      quizState.answers[quizState.currentIndex] = key;
      quizState.revealed[quizState.currentIndex] = true;
      renderCurrentQuestion();
    });

    quizElements.options.appendChild(optionBtn);
  });
}

function initQuiz() {
  const raw = typeof window.QUIZ_RAW === "string" ? window.QUIZ_RAW : "";
  quizState.allQuestions = parseQuestionBank(raw);

  if (!quizState.allQuestions.length) {
    quizElements.loadStatus.textContent =
      "Không đọc được bộ câu hỏi từ pt.txt. Vui lòng kiểm tra file dữ liệu.";
    if (quizElements.startBtn) quizElements.startBtn.disabled = true;
    return;
  }

  quizElements.loadStatus.textContent = `Đã nạp ${quizState.allQuestions.length} câu hỏi.`;

  const legacyCheckBtn = document.getElementById("quiz-check-btn");
  if (legacyCheckBtn) legacyCheckBtn.hidden = true;

  quizElements.startBtn.addEventListener("click", startQuiz);
  quizElements.prevBtn.addEventListener("click", () => moveQuestion(-1));
  quizElements.nextBtn.addEventListener("click", () => moveQuestion(1));
  quizElements.submitBtn.addEventListener("click", submitQuiz);
}

initQuiz();

function initStudyToc() {
  const tocLinks = Array.from(
    document.querySelectorAll('#panel-bai-giang .toc a[href^="#"]'),
  );
  if (!tocLinks.length) return;
  const tocScroller = document.querySelector("#panel-bai-giang .toc");

  const trackedSections = tocLinks
    .map((link) => {
      const id = link.getAttribute("href");
      const section = id ? document.querySelector(id) : null;
      return section ? { id, link, section } : null;
    })
    .filter(Boolean);

  if (!trackedSections.length) return;

  let activeId = "";

  const keepActiveLinkVisible = (link) => {
    if (!link || !tocScroller) return;
    link.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "smooth",
    });
  };

  const setActiveLink = (nextActiveId) => {
    trackedSections.forEach(({ id, link }) => {
      link.classList.toggle("active", id === nextActiveId);
    });
  };

  const updateActiveSection = () => {
    const viewportAnchor = window.innerHeight * 0.24;
    let current = trackedSections[0];

    trackedSections.forEach((entry) => {
      if (entry.section.getBoundingClientRect().top <= viewportAnchor) {
        current = entry;
      }
    });

    if (!current || current.id === activeId) return;
    activeId = current.id;
    setActiveLink(activeId);
    keepActiveLinkVisible(current.link);
  };

  tocLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const id = link.getAttribute("href");
      const target = id ? document.querySelector(id) : null;
      if (!id || !target) return;

      event.preventDefault();
      activeId = id;
      setActiveLink(id);
      keepActiveLinkVisible(link);
      target.scrollIntoView({ behavior: "smooth", block: "start" });

      if (history.replaceState) {
        history.replaceState(null, "", id);
      } else {
        window.location.hash = id;
      }
    });
  });

  window.addEventListener("scroll", updateActiveSection, { passive: true });
  window.addEventListener("hashchange", updateActiveSection);
  updateActiveSection();
}

initStudyToc();
