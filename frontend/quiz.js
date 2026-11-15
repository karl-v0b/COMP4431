(() => {
  const el = id => document.getElementById(id);
  const settings = el('quiz-settings'), answers = el('quiz-answers'), status = el('quiz-status');
  let quiz = null;
  function mode(isQuiz) {
    el('quiz-panel').hidden = !isQuiz;
    el('messages').hidden = isQuiz;
    el('chat-form').hidden = isQuiz;
    el('chat-mode').setAttribute('aria-pressed', String(!isQuiz));
    el('quiz-mode').setAttribute('aria-pressed', String(isQuiz));
  }
  el('chat-mode').onclick = () => mode(false);
  el('quiz-mode').onclick = () => mode(true);
  function node(tag, text, className) {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (className) n.className = className;
    return n;
  }
  async function request(url, body) {
    const res = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
    const data = await res.json();
    if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Please check your answers and try again.');
    return data;
  }
  function busy(value) {
    settings.querySelectorAll('input, select, button').forEach(n => n.disabled = value);
  }
  settings.onsubmit = async event => {
    event.preventDefault();
    busy(true);
    status.textContent = 'Generating questions from your notes… This may take a few minutes on a local model.';
    answers.hidden = true;
    quiz = null;
    try {
      quiz = await request('/api/quiz', {topic: el('quiz-topic').value.trim(), count: Number(el('quiz-count').value), difficulty: el('quiz-difficulty').value, language: el('quiz-language').value});
      answers.replaceChildren();
      quiz.questions.forEach((q, i) => {
        const field = node('fieldset');
        field.append(node('legend', `${i + 1}. ${q.question}`));
        q.options.forEach((option, j) => {
          const label = node('label', undefined, 'quiz-option');
          const input = document.createElement('input');
          input.type = 'radio'; input.name = `question-${i}`; input.value = j; input.required = true;
          label.append(input, node('span', `${String.fromCharCode(65 + j)}. ${option}`));
          field.append(label);
        });
        answers.append(field);
      });
      const submit = node('button', 'Submit answers'); submit.type = 'submit'; answers.append(submit);
      answers.hidden = false;
      status.textContent = 'Choose one answer for each question.';
    } catch (error) { status.textContent = error.message; }
    finally { busy(false); }
  };
  answers.onsubmit = async event => {
    event.preventDefault();
    if (!quiz) return;
    const selected = new FormData(answers);
    const values = quiz.questions.map((_, i) => Number(selected.get(`question-${i}`)));
    const button = answers.querySelector('button');
    button.disabled = true; busy(true);
    answers.querySelectorAll('input').forEach(n => n.disabled = true);
    status.textContent = 'Checking answers…';
    try {
      const result = await request(`/api/quiz/${quiz.id}/submit`, {answers: values});
      status.textContent = `Score: ${result.score} / ${result.total} (${Math.round(result.score / result.total * 100)}%)`;
      result.results.forEach((item, i) => {
        const feedback = node('div', undefined, `quiz-feedback ${item.correct ? 'correct' : 'incorrect'}`);
        feedback.append(node('strong', item.correct ? 'Correct' : `Incorrect — correct answer: ${String.fromCharCode(65 + item.answer)}. ${quiz.questions[i].options[item.answer]}`), node('p', item.explanation));
        const evidence = node('details');
        evidence.append(node('summary', `${item.source} · Page ${item.page} · Supporting passage`), node('pre', item.excerpt));
        feedback.append(evidence);
        answers.querySelectorAll('fieldset')[i].append(feedback);
      });
      button.hidden = true;
    } catch (error) {
      status.textContent = error.message; button.disabled = false;
      answers.querySelectorAll('input').forEach(n => n.disabled = false);
    } finally { busy(false); }
  };
})();
