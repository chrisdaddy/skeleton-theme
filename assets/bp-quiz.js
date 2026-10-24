// <bp-quiz>: product finder. Without JavaScript the first question's answers are links to
// their results. With it, one question shows at a time; the last answer chosen with a
// result decides the recommendation, shown with a link to it. Focus follows each step.

class BpQuiz extends HTMLElement {
  connectedCallback() {
    this.steps = [...this.querySelectorAll('.bp-quiz__step')];
    this.result = this.querySelector('[data-bp-result]');
    this.status = this.querySelector('[data-bp-quiz-status]');
    if (!this.steps.length) return;
    this.addEventListener('click', this.onClick);
    this.start();
  }

  start() {
    this.choice = null;
    this.show(0);
  }

  show(index) {
    this.index = index;
    this.steps.forEach((step, i) => (step.hidden = i !== index));
    this.result.hidden = true;
    if (this.steps.length > 1) this.status.textContent = (this.dataset.stepLabel || '').replace('[current]', index + 1);
  }

  onClick = (event) => {
    if (event.target.closest('[data-bp-restart]')) {
      this.start();
      this.steps[0].querySelector('.bp-quiz__answer')?.focus();
      return;
    }
    const answer = event.target.closest('.bp-quiz__answer');
    if (!answer) return;
    event.preventDefault();
    answer.closest('ul').querySelectorAll('.bp-quiz__answer').forEach((a) => a.removeAttribute('aria-current'));
    answer.setAttribute('aria-current', 'true');
    if (answer.dataset.resultUrl) this.choice = answer;
    if (this.index < this.steps.length - 1) {
      this.show(this.index + 1);
      this.steps[this.index].querySelector('.bp-quiz__answer')?.focus();
    } else {
      this.finish();
    }
  };

  finish() {
    const choice = this.choice;
    this.steps.forEach((step) => (step.hidden = true));
    this.result.querySelector('[data-bp-result-text]').textContent = choice?.dataset.resultText || '';
    const link = this.result.querySelector('[data-bp-result-link]');
    link.hidden = !choice;
    if (choice) link.href = choice.dataset.resultUrl;
    this.result.hidden = false;
    this.status.textContent = choice?.dataset.resultText || '';
    this.result.focus();
  }
}

if (!customElements.get('bp-quiz')) customElements.define('bp-quiz', BpQuiz);
