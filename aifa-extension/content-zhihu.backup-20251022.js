(function () {
  const ALLOWED_ORIGINS = [
    'http://localhost',
    'http://localhost:3000',
    'https://aifa.aixiaohu.top'
  ];

  if (!window.__AIFA_SIMPLE) {
    window.__AIFA_SIMPLE = true;
    console.log('[AIFA] 简化版内容脚本已注入:', location.href);
  }

  function waitForElement(selector, timeoutMs = 15000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const timer = setInterval(() => {
        const element = document.querySelector(selector);
        if (element) {
          clearInterval(timer);
          resolve(element);
        }
        if (Date.now() - start >= timeoutMs) {
          clearInterval(timer);
          resolve(null);
        }
      }, 200);
    });
  }

  function resolveTargetOrigin(origin) {
    return origin === 'null' ? '*' : origin;
  }

  function postMessageToSource(sourceWindow, targetOrigin, message) {
    if (!sourceWindow) {
      console.warn('[AIFA] 无法发送消息：缺少消息来源窗口');
      return;
    }

    try {
      sourceWindow.postMessage(message, targetOrigin);
    } catch (error) {
      console.error('[AIFA] 向来源窗口发送消息失败:', error);
    }
  }

  async function fillTitle(title) {
    const candidateSelectors = [
      'textarea[placeholder*="请输入标题" i]',
      'textarea[placeholder*="文章标题" i]',
      '.TitleInput textarea',
      'input[type="text"][placeholder*="标题" i]',
      'div[contenteditable="true"][data-first-focus="title"]'
    ];

    let titleElement = null;
    for (const selector of candidateSelectors) {
      titleElement = document.querySelector(selector);
      if (titleElement) break;
    }

    if (!titleElement) {
      const editableCandidates = Array.from(
        document.querySelectorAll('div[contenteditable="true"], input[type="text"], textarea')
      );
      titleElement = editableCandidates
        .filter((element) => element.offsetParent !== null)
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
    }

    if (!titleElement) {
      throw new Error('未找到标题输入框');
    }

    titleElement.focus();
    if (typeof titleElement.select === 'function') {
      titleElement.select();
    }
    document.execCommand('delete');
    const inserted = document.execCommand('insertText', false, title);
    if (!inserted) {
      if ('value' in titleElement) {
        titleElement.value = title;
      } else {
        titleElement.textContent = title;
      }
    }

    ['input', 'change', 'blur'].forEach((eventType) => {
      const event = new Event(eventType, { bubbles: true });
      titleElement.dispatchEvent(event);
    });

    document.body.click();
  }

  async function fillContent(htmlContent) {
    const editorSelectors = [
      '.DraftEditor-editorContainer .public-DraftEditor-content',
      '.public-DraftEditor-content',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]'
    ];

    let editorElement = null;
    for (const selector of editorSelectors) {
      editorElement = document.querySelector(selector);
      if (editorElement) break;
    }

    if (!editorElement) {
      editorElement = await waitForElement('.public-DraftEditor-content');
    }

    if (!editorElement) {
      throw new Error('未找到正文编辑器');
    }

    editorElement.focus();
    document.execCommand('selectAll');
    document.execCommand('delete');

    const inserted = document.execCommand('insertHTML', false, htmlContent);
    if (!inserted) {
      editorElement.innerHTML = htmlContent;
    }

    const changeEvent = new Event('input', { bubbles: true });
    editorElement.dispatchEvent(changeEvent);
  }

  async function handleTask(event, task) {
    if (task?.platform !== 'zhihu' || !task.payload) {
      return;
    }

    try {
      await fillTitle(task.payload.title || '');
      await fillContent(task.payload.content || '');

      if (task.autoPublish) {
        const publishButtonSelectors = [
          'button[class*="PublishButton"]',
          'button[data-test-id="post-submit-button"]',
          'button[data-testid="post-submit-button"]',
          'button[data-zop="submit"]'
        ];

        let publishButton = null;

        for (const selector of publishButtonSelectors) {
          publishButton = document.querySelector(selector);
          if (publishButton) {
            break;
          }
        }

        if (!publishButton) {
          const candidateKeywords = ['发布', '提交', '立即发布', '确认发布'];
          publishButton = Array.from(document.querySelectorAll('button'))
            .find((buttonElement) => {
              const textContent = buttonElement.textContent?.trim() ?? '';
              return candidateKeywords.some((keyword) => textContent.includes(keyword));
            });
        }

        if (!publishButton) {
          throw new Error('未找到发布按钮');
        }

        publishButton.click();
      }

      postMessageToSource(event.source, resolveTargetOrigin(event.origin), {
        type: 'AIFA_TASK_RESULT',
        platform: 'zhihu',
        status: 'success'
      });
    } catch (error) {
      console.error('[AIFA] 处理任务失败:', error);
      postMessageToSource(event.source, resolveTargetOrigin(event.origin), {
        type: 'AIFA_TASK_RESULT',
        platform: 'zhihu',
        status: 'failed',
        error: error?.message || '未知错误'
      });
    }
  }

  window.addEventListener('message', (event) => {
    if (!ALLOWED_ORIGINS.includes(event.origin) && event.origin !== 'null') {
      return;
    }

    const targetOrigin = resolveTargetOrigin(event.origin);

    if (event.data === 'AIFA_PUBLISH_REQUEST') {
      postMessageToSource(event.source, targetOrigin, { type: 'AIFA_READY', platform: 'zhihu' });
      return;
    }

    if (event.data?.type === 'AIFA_TASK') {
      handleTask(event, event.data);
    }
  });
})();
