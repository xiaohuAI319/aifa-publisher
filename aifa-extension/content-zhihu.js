(function () {
  // 允许接收任务的网页来源（请按需修改为你的域名）
  const ALLOWED_ORIGINS = [
    'http://localhost',
    'http://localhost:3000',
    'https://cloud1-2galtebofd65ac99-1360656182.tcloudbaseapp.com',
    'https://aifa.aixiaohu.top',
    'https://aixiaohu.top'
  ]; // 允许来自编辑器页的消息（sender origin），而非知乎自身 origin

  const logger = {
    log: () => {},
    info: () => {},
    warn: () => {},
    debug: () => {},
    error: (...args) => {
      if (typeof console === 'object' && typeof console.error === 'function') {
        console.error(...args);
      }
    }
  };

  const PENDING_TASK_STORAGE_KEY = 'AIFA_SIMPLE_PENDING_TASK';

  function getPendingTaskRecord() {
    try {
      const raw = sessionStorage.getItem(PENDING_TASK_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw);
    } catch (error) {
      logger.warn('[AIFA] 读取 Pending 任务失败:', error);
      return null;
    }
  }

  function persistPendingTaskRecord(record) {
    try {
      const payload = {
        ...record,
        createdAt: Date.now()
      };
      sessionStorage.setItem(PENDING_TASK_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      logger.error('[AIFA] 持久化 Pending 任务失败:', error);
    }
  }

  function clearPendingTaskRecord() {
    try {
      sessionStorage.removeItem(PENDING_TASK_STORAGE_KEY);
    } catch (error) {
      logger.warn('[AIFA] 清理 Pending 任务失败:', error);
    }
  }

  function postMessageWithCandidates(targetWindow, message, candidateOrigins) {
    for (const origin of candidateOrigins) {
      try {
        targetWindow.postMessage(message, origin);
        logger.log('[AIFA] postMessage 成功，origin =', origin, message);
        return true;
      } catch (error) {
        console.error('[AIFA] postMessage 失败，origin =', origin, error);
      }
    }
    return false;
  }

  function resumePendingTaskIfNeeded() {
    const pending = getPendingTaskRecord();
    if (!pending) {
      return;
    }
    if (!pending.taskId) {
      clearPendingTaskRecord();
      return;
    }
    const isArticlePage =
      location.host === 'zhuanlan.zhihu.com' && location.pathname.startsWith('/p/');
    if (!isArticlePage) {
      return;
    }
    if (!window.opener) {
      logger.warn('[AIFA] 无法补发任务结果，因为 window.opener 不存在');
      clearPendingTaskRecord();
      return;
    }

    const message = {
      type: 'AIFA_TASK_RESULT',
      status: pending.status || 'success',
      taskId: pending.taskId,
      url: location.href
    };

    const candidateOrigins = [];
    if (pending.targetOrigin && pending.targetOrigin !== '*') {
      candidateOrigins.push(pending.targetOrigin);
    }
    candidateOrigins.push('*');

    const hasSucceeded = postMessageWithCandidates(window.opener, message, candidateOrigins);
    if (hasSucceeded) {
      clearPendingTaskRecord();
      logger.log('[AIFA] 已在文章页补发任务结果');
    } else {
      logger.warn('[AIFA] 在文章页补发任务结果失败');
    }
  }

  resumePendingTaskIfNeeded();

  if (!window.__AIFA_SIMPLE) {
    window.__AIFA_SIMPLE = true;
    logger.log('[AIFA] 简化版内容脚本已注入:', location.href);
  }

  // 简易等待函数
  function waitFor(sel, ms) {
    if (ms === void 0) { ms = 15000; }
    return new Promise(function (resolve) {
      const start = Date.now();
      const timer = setInterval(function () {
        const el = document.querySelector(sel);
        if (el) { clearInterval(timer); resolve(el); }
        if (Date.now() - start > ms) { clearInterval(timer); resolve(null); }
      }, 200);
    });
  }

  function fireEvents(el, types) {
    if (types === void 0) { types = ["input", "change", "blur"]; }
    types.forEach(function (t) { return el.dispatchEvent(new Event(t, { bubbles: true })); });
  }

  // aifa-main 风格的标题填充逻辑 - 借鉴智能查找和渐进式降级
  async function fillTitle(title) {
    logger.log('[AIFA] 开始填充标题（aifa-main风格）');

    // 1. 智能查找标题输入框 - 借鉴aifa-main的逻辑
    const titleElement = await findTitleElementSmartly();

    if (!titleElement) {
      throw new Error('未找到标题输入框');
    }

    logger.log('[AIFA] 找到标题输入框，开始填充:', {
      tagName: titleElement.tagName,
      type: titleElement.type,
      placeholder: titleElement.placeholder,
      className: titleElement.className
    });

    // 2. 渐进式降级填充策略
    const fillStrategies = [
      fillTitleDirectly,           // Level 1: 直接设置value（aifa-main方法）
      fillTitleViaEvents,          // Level 2: 通过事件设置
      fillTitleViaExecCommand,     // Level 3: execCommand方法（原方法）
      fillTitleCharByChar          // Level 4: 逐字符输入（兜底方案）
    ];

    for (let i = 0; i < fillStrategies.length; i++) {
      try {
        logger.log(`[AIFA] 尝试策略 ${i + 1}/${fillStrategies.length}: ${fillStrategies[i].name}`);
        const success = await fillStrategies[i](titleElement, title);

        if (success) {
          logger.log(`[AIFA] 标题填充成功，使用策略: ${fillStrategies[i].name}`);

          // 等待2秒 - 借鉴aifa-main
          await new Promise(r => setTimeout(r, 2000));

          // 移出焦点
          document.body.click();
          await new Promise(r => setTimeout(r, 300));

          return true;
        }
      } catch (error) {
        logger.warn(`[AIFA] 策略 ${i + 1} 失败:`, error.message);
        // 继续尝试下一个策略
      }
    }

    throw new Error('所有标题填充策略都失败了');
  }

  // 智能查找标题输入框 - 借鉴aifa-main逻辑
  async function findTitleElementSmartly() {
    logger.log('[AIFA] 智能查找标题输入框...');

    // 1. 智能查找：按位置排序选择最上方的可编辑元素（aifa-main逻辑复用）
    const allEditableElements = document.querySelectorAll('div[contenteditable="true"], input[type="text"], textarea');

    // 按照在页面中的垂直位置排序
    const sortedElements = Array.from(allEditableElements).sort((a, b) => {
      const rectA = a.getBoundingClientRect();
      const rectB = b.getBoundingClientRect();
      return rectA.top - rectB.top;
    });

    // 查找标题输入框：排除插件自己的输入框，选择第一个（最上方的）
    let titleElement = sortedElements.find(element =>
      !element.id.includes('AIFA') &&
      !element.className.includes('AIFA') &&
      element.offsetParent !== null && // 确保可见
      element.getBoundingClientRect().height < 200 && // 标题框高度通常较小
      (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' ||
       (element.tagName === 'DIV' && element.contentEditable === 'true'))
    );

    if (titleElement) {
      logger.log('[AIFA] 智能查找成功找到标题元素');
      return titleElement;
    }

    // 2. 降级到固定选择器 - 借鉴aifa-main备用方案
    const fallbackSelectors = [
      '.WriteIndex-titleInput input',
      'textarea[placeholder*="请输入标题"]',
      'textarea[placeholder*="输入文章标题"]',
      'textarea[placeholder*="标题"]',
      'input[placeholder*="请输入标题"]',
      'input[placeholder*="标题"]',
      '.TitleInput textarea, .TitleInput input',
      '[class*="title"] textarea, [class*="title"] input'
    ];

    for (const selector of fallbackSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        logger.log('[AIFA] 备用选择器找到标题元素:', selector);
        return element;
      }
    }

    logger.warn('[AIFA] 未找到任何标题输入框');
    return null;
  }

  // Level 1: 直接设置value - aifa-main的主要方法
  async function fillTitleDirectly(element, title) {
    try {
      // 聚焦并滚动到元素
      element.focus();
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(r => setTimeout(r, 200));

      // 直接设置值 - aifa-main的核心方法
      element.value = '';
      element.value = title;

      // 触发必要的事件 - 借鉴aifa-main
      const events = ['input', 'change', 'blur'];
      for (const eventType of events) {
        const event = new Event(eventType, { bubbles: true });
        element.dispatchEvent(event);
        await new Promise(r => setTimeout(r, 100));
      }

      // 验证标题是否设置成功
      if (element.value === title) {
        return true;
      } else {
        logger.warn('直接设置失败，实际值:', element.value);
        return false;
      }
    } catch (error) {
      console.error('直接设置方法失败:', error);
      return false;
    }
  }

  // Level 2: 通过事件设置
  async function fillTitleViaEvents(element, title) {
    try {
      element.focus();
      element.click();
      await new Promise(r => setTimeout(r, 100));

      // 先select再delete再insert
      element.select();
      await new Promise(r => setTimeout(r, 50));

      // 模拟键盘输入事件
      const inputEvent = new InputEvent('input', {
        inputType: 'insertText',
        data: title,
        bubbles: true,
        cancelable: true
      });

      element.dispatchEvent(inputEvent);
      await new Promise(r => setTimeout(r, 100));

      // 验证
      const currentValue = element.value || element.textContent || '';
      return currentValue.includes(title) || currentValue.trim() === title.trim();
    } catch (error) {
      console.error('事件方法失败:', error);
      return false;
    }
  }

  // Level 3: execCommand方法
  async function fillTitleViaExecCommand(element, title) {
    try {
      element.focus();
      element.select();
      document.execCommand('delete');
      await new Promise(r => setTimeout(r, 50));

      const success = document.execCommand('insertText', false, title);
      await new Promise(r => setTimeout(r, 100));

      return success;
    } catch (error) {
      console.error('execCommand方法失败:', error);
      return false;
    }
  }

  // Level 4: 逐字符输入 - 最后的兜底方案
  async function fillTitleCharByChar(element, title) {
    try {
      element.focus();
      element.select();
      document.execCommand('delete');
      await new Promise(r => setTimeout(r, 100));

      for (let i = 0; i < title.length; i++) {
        const char = title[i];

        // 尝试beforeinput事件
        const beforeInputEvent = new InputEvent('beforeinput', {
          inputType: 'insertText',
          data: char,
          bubbles: true,
          cancelable: true
        });

        element.dispatchEvent(beforeInputEvent);

        // 如果beforeinput被阻止，直接修改内容
        if (beforeInputEvent.defaultPrevented) {
          element.value += char;
        }

        const afterInputEvent = new InputEvent('input', {
          inputType: 'insertText',
          data: char,
          bubbles: true
        });
        element.dispatchEvent(afterInputEvent);

        await new Promise(r => setTimeout(r, 50)); // 较短的延迟
      }

      return true;
    } catch (error) {
      console.error('逐字符输入失败:', error);
      return false;
    }
  }

  // 防止重复调用的标志
  let isFillingContent = false;
  let isProcessingTask = false;
  let lastTaskId = null;
  let currentTaskId = null;
  let currentTaskResponseWindow = null;
  let currentTaskResponseOrigin = '*';

  // aifa-main 风格的内容填充逻辑 - 借鉴智能等待和Draft.js处理
  async function fillContent(htmlContent) {
    // 防止重复调用
    if (isFillingContent) {
      logger.log('[AIFA] 内容填充正在进行中，跳过重复调用');
      return true;
    }

    isFillingContent = true;
    logger.log('[AIFA] 开始填充正文内容（aifa-main风格）');

    try {
      // 1. 智能等待编辑器就绪 - 借鉴aifa-main
      const editorElement = await waitForEditorReady();

      if (!editorElement) {
        throw new Error('编辑器未就绪或找不到');
      }

      logger.log('[AIFA] 编辑器就绪，开始填充内容');

      // 2. 渐进式降级填充策略
      const contentStrategies = [
        fillContentViaRealCopyPaste, // Level 0: 真正的复制粘贴策略（借鉴桌面版）
        fillContentViaPaste,        // Level 1: 粘贴方式（blog-auto-publishing-tools方法）
        fillContentViaDraftJS,      // Level 2: Draft.js专用处理（aifa-main方法）
        fillContentViaEvents,       // Level 3: 事件方式
        fillContentCharByChar       // Level 4: 逐字符输入（兜底方案）
      ];

      for (let i = 0; i < contentStrategies.length; i++) {
        try {
          logger.log(`[AIFA] 尝试内容策略 ${i + 1}/${contentStrategies.length}: ${contentStrategies[i].name}`);
          const success = await contentStrategies[i](editorElement, htmlContent);

          if (success) {
            logger.log(`[AIFA] ✅ 内容填充成功！使用策略: ${contentStrategies[i].name}`);
            if (i === 0) {
              logger.log('[AIFA] 🎯 首选策略成功，知乎应该自动更新字数统计');
            } else {
              logger.log(`[AIFA] ⚠️ 降级策略 ${i + 1} 成功`);
            }

            // 3. 等待内容稳定，不触发可能清空内容的React事件
            await new Promise(r => setTimeout(r, 1000));

            return true;
          }
        } catch (error) {
          if (i === 0) {
            logger.warn(`[AIFA] ❌ 首选策略失败:`, error.message);
          } else {
            logger.warn(`[AIFA] ⚠️ 降级策略 ${i + 1} 失败:`, error.message);
          }
          // 继续尝试下一个策略
        }
      }

      throw new Error('所有内容填充策略都失败了');
    } finally {
      // 重置标志
      isFillingContent = false;
    }
  }

  // 触发知乎React事件 - 极简版
  async function triggerZhihuContentEvents(element) {
    try {
      logger.log('[AIFA] 触发知乎React事件（极简版）...');

      // 1. 等待内容稳定
      await new Promise(r => setTimeout(r, 500));

      // 2. 检查内容是否存在
      const contentLength = (element.textContent || element.innerText || '').length;
      logger.log('[AIFA] 当前内容长度:', contentLength);

      if (contentLength > 0) {
        // 3. 只做最基本的事件触发
        element.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 200));

        element.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(r => setTimeout(r, 200));

        // 4. 简单的焦点切换
        element.dispatchEvent(new Event('blur', { bubbles: true }));
        await new Promise(r => setTimeout(r, 200));

        element.focus();
        await new Promise(r => setTimeout(r, 200));

        element.dispatchEvent(new Event('focus', { bubbles: true }));
        await new Promise(r => setTimeout(r, 200));

        logger.log('[AIFA] 基础事件触发完成');
      }

      logger.log('[AIFA] React事件触发完成');
      return true;
    } catch (error) {
      logger.warn('[AIFA] 触发React事件失败:', error);
      return false;
    }
  }

  // 强制React组件更新 - 安全版
  async function forceReactUpdate(element) {
    try {
      logger.log('[AIFA] 强制React组件更新（安全版）...');

      // 1. 确保编辑器有焦点
      element.focus();
      await new Promise(r => setTimeout(r, 200));

      // 2. 只触发最基本的input事件，避免复杂的React错误
      const inputEvent = new InputEvent('input', {
        inputType: 'insertText',
        data: '',
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(inputEvent);
      await new Promise(r => setTimeout(r, 100));

      // 3. 触发change事件
      element.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 100));

      logger.log('[AIFA] React组件更新完成（安全版）');
    } catch (error) {
      logger.warn('[AIFA] React组件更新失败:', error);
    }
  }

  // 模拟真实用户输入 - 简化版
  async function simulateRealUserInput(element) {
    try {
      logger.log('[AIFA] 模拟真实用户输入...');

      // 1. 确保元素有焦点
      element.focus();
      await new Promise(r => setTimeout(r, 200));

      // 2. 直接使用execCommand模拟输入（更可靠）
      for (let i = 0; i < 2; i++) {
        // 输入一个字符
        document.execCommand('insertText', false, ' ');
        await new Promise(r => setTimeout(r, 200));

        // 删除这个字符
        document.execCommand('delete');
        await new Promise(r => setTimeout(r, 200));
      }

      // 3. 触发change事件
      element.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 100));

      // 4. 失去焦点再重新获得焦点
      element.dispatchEvent(new Event('blur', { bubbles: true }));
      await new Promise(r => setTimeout(r, 100));
      element.focus();
      element.dispatchEvent(new Event('focus', { bubbles: true }));
      await new Promise(r => setTimeout(r, 100));

      logger.log('[AIFA] 真实用户输入模拟完成');
    } catch (error) {
      logger.warn('[AIFA] 真实用户输入模拟失败:', error);
    }
  }

  
  
  // 智能等待编辑器就绪 - 借鉴aifa-main的waitForEditor逻辑
  async function waitForEditorReady(maxWaitTime = 10000) {
    logger.log('[AIFA] 智能等待编辑器就绪...');
    const startTime = Date.now();
    let attempts = 0;

    return new Promise((resolve) => {
      const checkEditor = () => {
        attempts++;
        const editorElement = findContentElementSmartly();

        // 检查编辑器是否就绪
        if (editorElement && isEditorReady(editorElement)) {
          logger.log(`✅ 编辑器就绪 (尝试 ${attempts} 次)`);
          resolve(editorElement);
          return;
        }

        // 检查超时
        if (Date.now() - startTime >= maxWaitTime || attempts >= 20) {
          logger.warn(`⏰ 编辑器等待超时 (尝试 ${attempts} 次)`);
          resolve(null); // 即使超时也返回null
          return;
        }

        // 继续等待 - 每500ms检查一次
        setTimeout(checkEditor, 500);
      };

      checkEditor();
    });
  }

  // 智能查找内容编辑器 - 借鉴aifa-main逻辑
  function findContentElementSmartly() {
    // aifa-main的选择器
    const contentSelectors = [
      '.public-DraftEditor-content[contenteditable="true"]',
      '.DraftEditor-editorContainer [contenteditable="true"]',
      '.notranslate[contenteditable="true"]',
      'div[role="textbox"]',
      '.DraftEditor-root .public-DraftEditor-content',
      '.public-DraftEditor-content',
      '[contenteditable="true"]',
      '.RichText'
    ];

    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
    }

    return null;
  }

  // 检查编辑器是否准备就绪 - 借鉴aifa-main的isEditorReady
  function isEditorReady(element) {
    if (!element) return false;

    // 内容编辑器存在且可编辑
    const contentReady = element.contentEditable === 'true' &&
                        element.offsetParent !== null &&
                        element.getBoundingClientRect().height > 0;

    return contentReady;
  }

  // Level 0: 直接复制粘贴策略 - 简化版blog-auto-publishing-tools
  async function fillContentViaRealCopyPaste(element, htmlContent) {
    try {
      logger.log('[AIFA] 简化版blog-auto-publishing-tools：直接复制粘贴HTML内容');

      // 1. 直接复制HTML内容到剪贴板 - 不需要临时页面
      logger.log('[AIFA] 步骤1: 直接复制HTML内容到剪贴板');

      // 跨平台兼容：检测操作系统
      const isMac = navigator.platform.includes('Mac');
      const cmdKey = isMac ? 'Meta' : 'Control';

      // 方法1: 使用剪贴板API直接复制HTML内容
      let copySuccess = false;
      try {
        // 创建临时元素用于复制HTML（使用原始HTML）
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        document.body.appendChild(tempDiv);

        // 全选并复制
        tempDiv.focus();
        document.execCommand('selectAll');
        await new Promise(r => setTimeout(r, 100));

        copySuccess = document.execCommand('copy');
        logger.log('[AIFA] 直接复制HTML结果:', copySuccess);

        // 清理临时元素
        document.body.removeChild(tempDiv);
      } catch (e) {
        logger.warn('[AIFA] 直接复制HTML失败:', e.message);
      }

      // 方法2: 如果HTML复制失败，复制文本内容作为备用
      if (!copySuccess && navigator.clipboard) {
        try {
          const textContent = htmlToText(htmlContent);
          await navigator.clipboard.writeText(textContent);
          copySuccess = true;
          logger.log('[AIFA] 剪贴板API复制文本成功');
        } catch (e) {
          logger.warn('[AIFA] 剪贴板API复制文本失败:', e.message);
        }
      }

      if (!copySuccess) {
        logger.warn('[AIFA] 复制命令失败，降级到直接插入策略');
        return false;
      }

      // 2. 定位编辑器并准备粘贴 - 简化版
      logger.log('[AIFA] 步骤2: 定位编辑器并准备粘贴');

      // 使用blog-auto-publishing-tools中的精确选择器
      const editorSelectors = [
        '.DraftEditor-editorContainer .public-DraftEditor-content',
        '.public-DraftEditor-content',
        '.DraftEditor-root .public-DraftEditor-content',
        '[contenteditable="true"]'
      ];

      let targetEditor = element;
      for (const selector of editorSelectors) {
        const foundEditor = document.querySelector(selector);
        if (foundEditor) {
          targetEditor = foundEditor;
          logger.log('[AIFA] 找到精确编辑器:', selector);
          break;
        }
      }

      // 3. 点击编辑器获得焦点 - 按照blog-auto-publishing-tools方式
      logger.log('[AIFA] 步骤3: 点击编辑器获得焦点');
      targetEditor.focus();
      targetEditor.click();
      await new Promise(r => setTimeout(r, 2000)); // blog-auto-publishing-tools等待2秒

      // 再次确保焦点
      targetEditor.focus();
      await new Promise(r => setTimeout(r, 300));

      // 4. 清空现有内容（如果有的话）
      logger.log('[AIFA] 步骤4: 清空现有内容');
      const currentContent = targetEditor.textContent || targetEditor.innerText || '';
      if (currentContent.trim().length > 0) {
        logger.log('[AIFA] 清空编辑器现有内容');
        document.execCommand('selectAll');
        await new Promise(r => setTimeout(r, 100));
        document.execCommand('delete');
        await new Promise(r => setTimeout(r, 500));
      }

      // 5. 执行Ctrl+V粘贴操作 - 简化版blog-auto-publishing-tools
      logger.log('[AIFA] 步骤5: 执行Ctrl+V粘贴操作');

      // 使用最简单的粘贴方式 - 直接执行粘贴命令
      try {
        // 先确保编辑器获得焦点
        targetEditor.focus();
        await new Promise(r => setTimeout(r, 200));

        const pasteSuccess = document.execCommand('paste');
        logger.log('[AIFA] 直接粘贴命令结果:', pasteSuccess);

        if (pasteSuccess) {
          // 粘贴成功，直接进入验证阶段
          logger.log('[AIFA] 直接粘贴命令成功');
        } else {
          // 直接粘贴失败，尝试键盘事件
          logger.log('[AIFA] 直接粘贴失败，使用键盘事件模拟');

          // 备用：模拟Ctrl+V键盘事件
          const keyDownEvent = new KeyboardEvent('keydown', {
            key: cmdKey,
            code: cmdKey === 'Meta' ? 'MetaLeft' : 'ControlLeft',
            location: 1,
            ctrlKey: !isMac,
            metaKey: isMac,
            bubbles: true,
            cancelable: true,
            composed: true
          });
          targetEditor.dispatchEvent(keyDownEvent);
          await new Promise(r => setTimeout(r, 30));

          // 按下V键
          const vKeyDownEvent = new KeyboardEvent('keydown', {
            key: 'v',
            code: 'KeyV',
            location: 0,
            ctrlKey: !isMac,
            metaKey: isMac,
            bubbles: true,
            cancelable: true,
            composed: true
          });
          targetEditor.dispatchEvent(vKeyDownEvent);
          await new Promise(r => setTimeout(r, 30));

          // paste事件 - 这是最关键的
          const pasteEvent = new ClipboardEvent('paste', {
            clipboardData: new DataTransfer(),
            bubbles: true,
            cancelable: true
          });

          // 尝试添加HTML和文本内容到剪贴板数据
          try {
            // 优先设置HTML格式，保持样式和图片
            pasteEvent.clipboardData.setData('text/html', htmlContent);
            logger.log('[AIFA] 设置HTML格式数据，长度:', htmlContent.length);

            // 同时设置纯文本格式作为备用
            const textContent = htmlToText(htmlContent);
            pasteEvent.clipboardData.setData('text/plain', textContent);
            logger.log('[AIFA] 设置文本格式数据，长度:', textContent.length);
          } catch (e) {
            logger.warn('[AIFA] 设置剪贴板数据失败:', e.message);
          }

          targetEditor.dispatchEvent(pasteEvent);
          await new Promise(r => setTimeout(r, 50));

          // 松开V键
          const vKeyUpEvent = new KeyboardEvent('keyup', {
            key: 'v',
            code: 'KeyV',
            location: 0,
            ctrlKey: !isMac,
            metaKey: isMac,
            bubbles: true,
            cancelable: true
          });
          targetEditor.dispatchEvent(vKeyUpEvent);
          await new Promise(r => setTimeout(r, 50));

          // 松开Ctrl/Meta键
          const keyUpEvent = new KeyboardEvent('keyup', {
            key: cmdKey,
            code: cmdKey === 'Meta' ? 'MetaLeft' : 'ControlLeft',
            location: 1,
            ctrlKey: false,
            metaKey: false,
            bubbles: true,
            cancelable: true
          });
          targetEditor.dispatchEvent(keyUpEvent);
          await new Promise(r => setTimeout(r, 100));
        }
      } catch (e) {
        logger.warn('[AIFA] 粘贴操作失败:', e.message);
      }

      // 6. 按照blog-auto-publishing-tools方式，等待处理完成
      logger.log('[AIFA] 步骤6: 等待知乎处理粘贴内容');

      // blog-auto-publishing-tools使用time.sleep(3)等待处理
      await new Promise(r => setTimeout(r, 3000));

      // 7. 验证内容
      const finalContent = targetEditor.textContent || targetEditor.innerText || '';
      const hasContent = finalContent.trim().length > 0;

      if (hasContent) {
        logger.log('[AIFA] ✅ 粘贴成功，内容长度:', finalContent.length);
        return true;
      } else {
        logger.warn('[AIFA] ❌ 粘贴失败，编辑器仍为空');
        return false;
      }

    } catch (error) {
      console.error('[AIFA] blog-auto-publishing-tools方式失败:', error);
      return false;
    }
  }

  // Level 1: 粘贴方式 - blog-auto-publishing-tools方法（知乎React兼容版）
  async function fillContentViaPaste(element, htmlContent) {
    try {
      logger.log('[AIFA] 尝试粘贴方式填充内容（知乎React兼容版）');

      // 1. 等待知乎编辑器稳定
      await new Promise(r => setTimeout(r, 1000));

      // 2. 确保编辑器有焦点
      element.click();
      element.focus();
      await new Promise(r => setTimeout(r, 300));

      // 3. 验证焦点
      if (document.activeElement !== element && !element.contains(document.activeElement)) {
        logger.warn('[AIFA] 编辑器未获得焦点，尝试强制聚焦');
        element.focus();
        await new Promise(r => setTimeout(r, 200));
      }

      // 4. 准备内容 - 保留HTML格式以支持图片，同时准备文本版本用于字数统计
      const textContent = htmlToText(htmlContent);
      logger.log('[AIFA] 准备插入内容，HTML长度:', htmlContent.length, '文本长度:', textContent.length);

      // 5. 清空现有内容
      const currentContent = element.textContent || element.innerText || '';
      if (currentContent.trim().length > 0) {
        logger.log('[AIFA] 清空现有内容');
        selectAllContent(element);
        await new Promise(r => setTimeout(r, 100));
        document.execCommand('delete');
        await new Promise(r => setTimeout(r, 500));
      }

      // 6. 尝试保留HTML格式插入内容（支持图片）
      logger.log('[AIFA] 尝试插入HTML内容，优先保留图片');
      let success = false;
      let hasImages = htmlContent.includes('<img') || htmlContent.includes('<image');

      // 6.1 先尝试直接插入HTML（如果支持）- 优先使用这个方式支持图片
      try {
        const cleanedHtml = processHtmlForZhihu(htmlContent);
        logger.log('[AIFA] 处理后的HTML内容长度:', cleanedHtml.length);

        // 尝试直接插入HTML，避免btoa编码问题
        success = document.execCommand('insertHTML', false, cleanedHtml);
        logger.log('[AIFA] insertHTML结果:', success);
      } catch (e) {
        logger.warn('[AIFA] insertHTML失败:', e.message);
        // 如果是编码错误，尝试使用encodeURIComponent方式
        if (e.message.includes('btoa') || e.message.includes('Latin1')) {
          try {
            logger.log('[AIFA] 尝试绕过btoa编码问题，使用备用方式');
            success = document.execCommand('insertText', false, textContent);
            logger.log('[AIFA] insertText备用方式结果:', success);
          } catch (fallbackError) {
            logger.warn('[AIFA] insertText备用方式也失败:', fallbackError.message);
          }
        }
      }

      // 6.2 如果insertHTML失败，尝试其他HTML插入方法
      if (!success) {
        logger.log('[AIFA] insertHTML失败，尝试innerHTML方式');
        try {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = htmlContent;
          const fragment = document.createDocumentFragment();
          while (tempDiv.firstChild) {
            fragment.appendChild(tempDiv.firstChild);
          }
          element.appendChild(fragment);
          success = true;
          logger.log('[AIFA] innerHTML方式成功');
        } catch (e) {
          logger.warn('[AIFA] innerHTML方式失败:', e.message);
        }
      }

      // 6.3 如果HTML方式都失败，降级到文本方式
      if (!success) {
        logger.log('[AIFA] HTML方式都失败，降级到insertText插入文本内容');
        success = document.execCommand('insertText', false, textContent);

        if (!success) {
          logger.warn('[AIFA] execCommand insertText失败，尝试textContent方式');
          // 备用方案：直接设置文本内容
          element.textContent = textContent;
        }
      }

      // 6.4 记录图片处理结果
      if (hasImages && success) {
        logger.log('[AIFA] 检测到图片内容，已尝试HTML插入方式');
      } else if (hasImages && !success) {
        logger.warn('[AIFA] 检测到图片内容，但HTML插入失败，可能只保留了文本');
      }

      // 7. 等待内容稳定，然后触发字数统计更新
      await new Promise(r => setTimeout(r, 500));

      // 8. 检查内容是否正确插入
      const checkContent = element.textContent || element.innerText || '';
      logger.log('[AIFA] 内容验证，当前长度:', checkContent.length);

      // 9. 最终验证
      await new Promise(r => setTimeout(r, 500));
      const finalContent = element.textContent || element.innerText || '';
      const hasContent = finalContent.trim().length > 0;

      if (hasContent) {
        logger.log('[AIFA] 粘贴方式成功，最终内容长度:', finalContent.length);
        return true;
      } else {
        throw new Error('内容插入后仍为空');
      }
    } catch (error) {
      console.error('粘贴方式失败:', error);
      return false;
    }
  }

  // 辅助函数：将文本分成小块
  function splitTextIntoChunks(text, chunkSize) {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // Level 2: Draft.js专用处理 - aifa-main方法（知乎兼容版）
  async function fillContentViaDraftJS(element, htmlContent) {
    try {
      logger.log('📝 填充Draft.js编辑器内容（知乎兼容版）');

      // 1. 等待知乎编辑器稳定
      await new Promise(r => setTimeout(r, 800));

      // 2. 获取焦点
      element.click();
      element.focus();
      await new Promise(r => setTimeout(r, 300));

      // 3. 验证焦点
      if (document.activeElement !== element && !element.contains(document.activeElement)) {
        logger.warn('[AIFA] Draft.js编辑器未获得焦点，强制聚焦');
        element.focus();
        await new Promise(r => setTimeout(r, 200));
      }

      // 4. 准备内容 - 保留HTML格式以支持图片，同时准备文本版本用于分段处理
      const textContent = htmlToText(htmlContent);
      const hasImages = htmlContent.includes('<img') || htmlContent.includes('<image');
      const chunks = splitTextIntoChunks(textContent, 80); // 更小的块
      logger.log('[AIFA] Draft.js方式：HTML长度:', htmlContent.length, '文本分块，共', chunks.length, '块', '包含图片:', hasImages);

      // 5. 清空现有内容（如果需要）
      const currentContent = element.textContent || element.innerText || '';
      if (currentContent.trim().length > 0) {
        logger.log('[AIFA] Draft.js方式：清空现有内容');
        await clearDraftEditorSimple(element);
        await new Promise(r => setTimeout(r, 500));
      }

      // 5.5. 如果包含图片，先尝试HTML插入
      if (hasImages) {
        logger.log('[AIFA] Draft.js方式：检测到图片，尝试HTML插入');
        try {
          const cleanedHtml = processHtmlForZhihu(htmlContent);
          const htmlSuccess = document.execCommand('insertHTML', false, cleanedHtml);
          if (htmlSuccess) {
            logger.log('[AIFA] Draft.js方式：HTML插入成功，跳过文本分段插入');
            await new Promise(r => setTimeout(r, 1000));

            // 验证HTML插入结果
            const contentAfterHtml = element.textContent || element.innerText || '';
            if (contentAfterHtml.trim().length > 0) {
              // HTML插入成功，知乎应该自动更新字数统计
              return true;
            }
          } else {
            logger.warn('[AIFA] Draft.js方式：HTML插入失败，继续文本插入');
          }
        } catch (e) {
          logger.warn('[AIFA] Draft.js方式：HTML插入异常，继续文本插入:', e.message);
        }
      }

      // 6. 分段插入，模拟人工输入（HTML插入失败或无图片时的备用方案）
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        logger.log('[AIFA] Draft.js方式：插入第', i + 1, '/', chunks.length, '块');

        try {
          // 使用Draft.js专用的温和插入方式
          await insertTextToDraftEditorSimple(element, chunk);

          // 每段之间等待更长时间，让Draft.js处理
          await new Promise(r => setTimeout(r, 400));

        } catch (chunkError) {
          logger.warn('[AIFA] Draft.js方式：第', i + 1, '块失败:', chunkError.message);
          // 继续尝试下一块
        }
      }

      // 7. 最终验证和稳定
      await new Promise(r => setTimeout(r, 1000));
      const finalContent = element.textContent || element.innerText || '';

      if (finalContent.trim().length > 0) {
        logger.log('[AIFA] Draft.js方式最终成功，内容长度:', finalContent.length);

        // 触发Draft.js的change事件
        const changeEvent = new Event('input', { bubbles: true });
        element.dispatchEvent(changeEvent);
        await new Promise(r => setTimeout(r, 200));

        // Draft.js输入应该会自动触发字数统计
        return true;
      } else {
        throw new Error('Draft.js方式插入后内容仍为空');
      }
    } catch (error) {
      console.error('Draft.js方式失败:', error);
      return false;
    }
  }

  // Level 3: 事件方式
  async function fillContentViaEvents(element, htmlContent) {
    try {
      const textContent = htmlToText(htmlContent);
      logger.log('[AIFA] 事件方式：HTML长度:', htmlContent.length, '文本长度:', textContent.length);

      element.focus();
      await new Promise(r => setTimeout(r, 200));

      // 通过InputEvent设置内容
      const inputEvent = new InputEvent('input', {
        inputType: 'insertText',
        data: textContent,
        bubbles: true,
        cancelable: true
      });

      element.dispatchEvent(inputEvent);
      await new Promise(r => setTimeout(r, 300));

      return true;
    } catch (error) {
      console.error('事件方式失败:', error);
      return false;
    }
  }

  // Level 4: 逐字符输入 - 最后的兜底方案
  async function fillContentCharByChar(element, htmlContent) {
    try {
      const textContent = htmlToText(htmlContent);
      logger.log('[AIFA] 逐字符方式：HTML长度:', htmlContent.length, '文本长度:', textContent.length);

      element.focus();
      await new Promise(r => setTimeout(r, 200));

      for (let i = 0; i < textContent.length; i++) {
        const char = textContent[i];

        const inputEvent = new InputEvent('beforeinput', {
          inputType: 'insertText',
          data: char,
          bubbles: true,
          cancelable: true
        });

        element.dispatchEvent(inputEvent);

        // 如果beforeinput被阻止，直接修改内容
        if (inputEvent.defaultPrevented) {
          element.textContent += char;
        }

        await new Promise(r => setTimeout(r, 30)); // 较短的延迟
      }

      return true;
    } catch (error) {
      console.error('逐字符输入失败:', error);
      return false;
    }
  }

  // 辅助函数：测试图片是否可访问
  async function testImageUrl(url) {
    return new Promise((resolve) => {
      if (!url || url.startsWith('data:')) {
        resolve(url); // data URL直接返回
        return;
      }

      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;

      // 5秒超时
      setTimeout(() => resolve(false), 5000);
    });
  }

  // 辅助函数：修复图片URL
  function fixImageUrl(imgUrl) {
    if (!imgUrl || typeof imgUrl !== 'string') return imgUrl;

    // 如果是完整的HTTP URL或data URL，直接返回（包括飞书图片）
    if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://') || imgUrl.startsWith('data:')) {
      return imgUrl;
    }

    // 如果是相对路径，尝试修复
    if (imgUrl.startsWith('//')) {
      return 'https:' + imgUrl; // 协议相对路径
    }

    if (imgUrl.startsWith('/')) {
      // 绝对路径，需要域名 - 这里使用通用的修复策略
      return 'https://pic1.zhimg.com' + imgUrl; // 知乎常用的图片域名
    }

    if (imgUrl.startsWith('./')) {
      return imgUrl.substring(2); // 移除 ./
    }

    // 其他情况，假设是相对路径，尝试直接使用
    logger.log('[AIFA] 图片URL格式未知，尝试直接使用:', imgUrl);
    return imgUrl;
  }

  // 辅助函数：处理HTML内容以适应知乎编辑器
  function processHtmlForZhihu(html) {
    if (typeof html !== 'string') return html;

    logger.log('[AIFA] 开始处理HTML内容，原始长度:', html.length);

    // 创建临时DOM元素来处理HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // 处理图片标签，确保它们能正确显示
    const images = tempDiv.querySelectorAll('img');
    logger.log('[AIFA] 发现图片数量:', images.length);

    images.forEach((img, index) => {
      logger.log(`[AIFA] 处理图片 ${index + 1}:`, {
        原始src: img.src,
        dataSrc: img.getAttribute('data-src'),
        dataOriginal: img.getAttribute('data-original'),
        alt: img.alt,
        class: img.className
      });

      // 获取所有可能的图片源
      let src = img.src || img.getAttribute('data-src') || img.getAttribute('data-original') ||
                img.getAttribute('src') || img.getAttribute('data-lazy-src');

      if (src) {
        // 修复图片URL，但不特别处理飞书图片（因为它们能正常显示）
        const fixedSrc = fixImageUrl(src);
        img.src = fixedSrc;
        logger.log(`[AIFA] 图片 ${index + 1} 设置src:`, src, '→', fixedSrc);
      } else {
        logger.warn(`[AIFA] 图片 ${index + 1} 没有有效的src属性`);
        // 添加一个占位符，避免图片完全丢失
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
          <svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#f5f5f5"/>
            <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="14" fill="#999" text-anchor="middle" dy=".3em">
              📷 图片加载失败
            </text>
          </svg>
        `)}`;
        img.alt = '图片加载失败';
      }

      // 移除可能导致问题的属性
      img.removeAttribute('loading');
      img.removeAttribute('srcset');
      img.removeAttribute('sizes');
      img.removeAttribute('data-src');
      img.removeAttribute('data-original');
      img.removeAttribute('data-lazy');

      // 添加基本样式，确保图片可见
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      img.style.display = 'block';
      img.style.margin = '10px 0';
      img.style.border = '1px solid #eee';

      logger.log(`[AIFA] 图片 ${index + 1} 处理完成，最终src:`, img.src);
    });

    // 处理其他可能有问题的标签
    // 保留基本的HTML标签：p, br, strong, em, img, a等
    const allowedTags = ['P', 'BR', 'STRONG', 'EM', 'B', 'I', 'U', 'IMG', 'A', 'DIV', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
    const allElements = tempDiv.querySelectorAll('*');

    allElements.forEach(element => {
      if (!allowedTags.includes(element.tagName)) {
        // 移除不允许的标签，但保留内容
        const parent = element.parentNode;
        while (element.firstChild) {
          parent.insertBefore(element.firstChild, element);
        }
        parent.removeChild(element);
      }
    });

    // 处理完成后验证图片
    const processedImages = tempDiv.querySelectorAll('img');
    logger.log('[AIFA] 处理后剩余图片数量:', processedImages.length);

    processedImages.forEach((img, index) => {
      logger.log(`[AIFA] 最终图片 ${index + 1} 验证:`, {
        src: img.src,
        有src: !!img.src,
        src长度: img.src ? img.src.length : 0
      });
    });

    const processedHtml = tempDiv.innerHTML;
    logger.log('[AIFA] HTML处理完成，处理后长度:', processedHtml.length);

    return processedHtml;
  }

  // 辅助函数：HTML转纯文本 - 借鉴aifa-main
  function htmlToText(html) {
    if (typeof html !== 'string') return html;

    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  }

  // 辅助函数：复制到剪贴板
  function copyToClipboard(text) {
    try {
      // 使用现代API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        return true;
      }

      // 降级到execCommand
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    } catch (error) {
      console.error('复制到剪贴板失败:', error);
      return false;
    }
  }

  // 简化的Draft.js清空方法
  async function clearDraftEditorSimple(element) {
    try {
      // 直接选择全部并删除
      selectAllContent(element);
      await new Promise(r => setTimeout(r, 100));
      document.execCommand('delete');
      await new Promise(r => setTimeout(r, 200));
    } catch (error) {
      logger.warn('清空Draft编辑器失败:', error);
    }
  }

  // 简化的Draft.js插入方法 - 不依赖剪贴板
  async function insertTextToDraftEditorSimple(element, text) {
    try {
      // 尝试直接插入文本
      const success = document.execCommand('insertText', false, text);

      if (!success) {
        logger.warn('[AIFA] execCommand insertText失败，尝试InputEvent');
        // 降级到InputEvent
        const inputEvent = new InputEvent('input', {
          inputType: 'insertText',
          data: text,
          bubbles: true,
          cancelable: true
        });
        element.dispatchEvent(inputEvent);
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (error) {
      logger.warn('Draft编辑器插入文本失败:', error);
    }
  }

  // 辅助函数：清空Draft.js编辑器 - 借鉴aifa-main（保留原版作为备用）
  async function clearDraftEditor(element) {
    try {
      element.focus();

      // 使用快捷键选择全部
      const selectAllEvent = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        metaKey: true, // Mac支持
        bubbles: true
      });
      element.dispatchEvent(selectAllEvent);

      await new Promise(r => setTimeout(r, 100));

      // 删除选中内容
      const deleteEvent = new KeyboardEvent('keydown', {
        key: 'Delete',
        bubbles: true
      });
      element.dispatchEvent(deleteEvent);

      await new Promise(r => setTimeout(r, 100));
    } catch (error) {
      logger.warn('清空Draft编辑器失败:', error);
    }
  }

  // 辅助函数：向Draft.js编辑器插入文本 - 借鉴aifa-main（保留原版作为备用）
  async function insertTextToDraftEditor(element, text) {
    try {
      // 模拟粘贴事件
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', text);

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: clipboardData,
        bubbles: true,
        cancelable: true
      });

      element.dispatchEvent(pasteEvent);
      await new Promise(r => setTimeout(r, 300));

      // 如果粘贴失败，尝试逐字符输入
      if (element.textContent.trim() === '') {
        await fillContentCharByChar(element, text);
      }

    } catch (error) {
      logger.warn('Draft编辑器插入文本失败，尝试备用方案:', error);
      await fillContentCharByChar(element, text);
    }
  }

  // 辅助函数：选择所有内容
  function selectAllContent(element) {
    try {
      if (element.select) {
        element.select();
      } else {
        // 对于contenteditable元素
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } catch (error) {
      logger.warn('选择内容失败:', error);
    }
  }

  // 改进的简单文本填充（降级方案）- 确保编辑器可编辑
  async function fillContentSimple(html) {
    logger.log('[AIFA] 使用简单文本填充方案');
    const editorSelector = '.public-DraftEditor-content, .RichText, [contenteditable="true"]';
    const editor = document.querySelector(editorSelector);
    if (!editor) return false;

    try {
      // 清除所有选择
      window.getSelection().removeAllRanges();

      // 聚焦编辑器
      editor.focus();
      await new Promise(r => setTimeout(r, 100));

      // 选择所有内容并删除（避免残留内容）
      const range = document.createRange();
      range.selectNodeContents(editor);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      // 删除现有内容
      document.execCommand('delete', false, null);

      // 清除选择，避免全选残留
      selection.removeAllRanges();

      // 提取纯文本
      const text = html
        .replace(/<\/?[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim();

      if (text) {
        // 光标移到开始位置
        const insertRange = document.createRange();
        insertRange.selectNodeContents(editor);
        insertRange.collapse(true);
        selection.addRange(insertRange);

        // 插入文本
        document.execCommand('insertText', false, text);

        // 重新激活编辑器，确保可编辑
        editor.setAttribute('contenteditable', 'true');
        editor.focus();

        // 触发编辑器事件
        const inputEvent = new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText'
        });
        editor.dispatchEvent(inputEvent);
      }

      // 最后确保编辑器处于可编辑状态
      editor.setAttribute('contenteditable', 'true');
      editor.click();
      await new Promise(r => setTimeout(r, 200));

      // 清除所有选择，确保用户可以正常编辑
      selection.removeAllRanges();

      logger.log('[AIFA] 简单文本填充完成');
      return true;

    } catch (e) {
      console.error('[AIFA] 简单文本填充失败:', e);
      return false;
    }
  }

  function tryClickPublish(autoPublish) {
    if (!autoPublish) { return Promise.resolve(true); }
    logger.log('[AIFA] 开始自动发布流程（blog-auto-publishing-tools风格）');

    return new Promise(function (resolve, reject) {
      try {
        // 1. 等待内容粘贴完成（blog-auto-publishing-tools使用time.sleep(3)）
        logger.log('[AIFA] 步骤1: 等待知乎处理粘贴内容...');

        // 2. 滚动页面到发布区域（blog-auto-publishing-tools使用scroll_by_amount(0, 800)）
        setTimeout(function() {
          logger.log('[AIFA] 步骤2: 滚动到发布区域');
          window.scrollBy(0, 800);

          // 3. 点击发布按钮（blog-auto-publishing-tools直接查找包含"发布"文字的按钮）
          setTimeout(function() {
            logger.log('[AIFA] 步骤3: 查找并点击发布按钮');

            // 使用blog-auto-publishing-tools的XPath方式：//button[contains(text(), "发布")]
            const xpath = '//button[contains(text(), "发布")]';
            logger.log(`[AIFA] 使用XPath: ${xpath}`);

            // 将XPath转换为CSS选择器
            const buttons = Array.from(document.querySelectorAll('button'));
            const publishButton = buttons.find(function(btn) {
              const text = (btn.innerText || btn.textContent || '').trim();
              return text.includes('发布');
            });

            if (publishButton) {
              logger.log('[AIFA] 找到发布按钮，点击发布');
              publishButton.click();

              setTimeout(function() {
                logger.log('[AIFA] ✅ 发布完成');
                resolve(true);
              }, 2000);
            } else {
              console.error('[AIFA] 未找到发布按钮');
              reject(new Error('未找到发布按钮'));
            }
          }, 500);
        }, 3000);

      } catch (error) {
        console.error('[AIFA] 自动发布失败:', error);
        reject(error);
      }
    });
  }

  function sendResult(win, status, extra) {
    const targetWindow = win || window.opener || window;
    if (!targetWindow) {
      console.error('[AIFA] 无法发送结果：未找到目标窗口');
      return;
    }

    const result = { type: 'AIFA_TASK_RESULT', status, ...extra };
    const candidateOrigins = [];
    if (currentTaskResponseOrigin && currentTaskResponseOrigin !== '*') {
      candidateOrigins.push(currentTaskResponseOrigin);
    }
    candidateOrigins.push('*');

    logger.log('[AIFA] 准备发送结果到网页:', result);
    logger.log('[AIFA] 候选目标origin:', candidateOrigins);

    let hasSucceeded = false;
    for (const origin of candidateOrigins) {
      try {
        targetWindow.postMessage(result, origin);
        logger.log('[AIFA] 结果已发送，origin =', origin);
        hasSucceeded = true;
        break;
      } catch (error) {
        console.error('[AIFA] 发送结果失败，origin =', origin, error);
      }
    }

    if (!hasSucceeded) {
      console.error('[AIFA] 所有尝试发送结果的目标都失败');
    }
  }

  
  
  
  
  // 仅在收到任务时再去查询/操作 DOM，避免过早干预页面脚本
  window.addEventListener('message', async (e) => {
    try {
      logger.log('[AIFA] 收到消息:', e.data, '来源:', e.origin);
      logger.log('[AIFA] 消息类型:', e.data?.type);

      // 处理简单字符串握手请求
      if (e.data === 'AIFA_PUBLISH_REQUEST') {
        // 只响应来自白名单的握手请求，避免处理自己发送的消息
        if (ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.some(origin => e.origin && e.origin.startsWith(origin))) {
          logger.warn('[AIFA] 忽略非白名单握手请求:', e.origin);
          return;
        }
        logger.log('[AIFA] 收到简单字符串握手请求:', e.origin);
        // 发送握手响应 - 直接通过window.opener发送给父窗口
        try {
          const readyMessage = { type: 'AIFA_READY', platform: 'zhihu' };
          if (e.source) {
            e.source.postMessage(readyMessage, e.origin || '*');
            logger.log('[AIFA] 通过event.source发送握手响应');
            currentTaskResponseWindow = e.source;
          } else if (window.opener) {
            window.opener.postMessage(readyMessage, e.origin || '*');
            logger.log('[AIFA] 通过window.opener发送握手响应');
            currentTaskResponseWindow = window.opener;
          } else {
            window.postMessage(readyMessage, e.origin || '*');
            logger.log('[AIFA] 通过window.postMessage发送握手响应');
            currentTaskResponseWindow = window;
          }
          currentTaskResponseOrigin = e.origin || '*';
        } catch (error) {
          logger.warn('[AIFA] 发送握手响应失败:', error);
          currentTaskResponseWindow = window;
          currentTaskResponseOrigin = '*';
        }
        return;
      }

      if (!e.data || e.data.type !== 'AIFA_TASK') {
        logger.log('[AIFA] 忽略非AIFA_TASK消息，收到:', e.data);
        return;
      }

      if (ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.some(origin => e.origin && e.origin.startsWith(origin))) {
        // 非白名单来源，忽略
        logger.warn('[AIFA] 收到非白名单来源消息:', e.origin, '允许的来源:', ALLOWED_ORIGINS);
        return;
      }

      // 检查是否是重复任务
      if (isProcessingTask) {
        logger.log('[AIFA] 任务正在处理中，跳过重复任务');
        return;
      }

      const { platform, autoPublish, payload, taskId } = e.data;
      if (platform !== 'zhihu') {
        logger.warn('[AIFA] 非知乎平台任务，忽略');
        return;
      }

      if (!taskId) {
        logger.warn('[AIFA] 收到不包含taskId的任务，忽略');
        return;
      }

      currentTaskId = taskId;
      currentTaskResponseWindow = e.source || window.opener || null;
      currentTaskResponseOrigin = e.origin || '*';
      persistPendingTaskRecord({
        taskId,
        status: 'success',
        targetOrigin: currentTaskResponseOrigin
      });

      // 标记开始处理任务
      isProcessingTask = true;
      lastTaskId = taskId;

      logger.log('[AIFA] 开始处理任务:', e.data, '任务ID:', taskId);

      try {
        logger.log('[AIFA] 等待页面缓冲...');
        // 先给页面脚本一个缓冲时间，避免和站点初始化时序冲突
        await new Promise(r => setTimeout(r, 1500));

        logger.log('[AIFA] 开始查找编辑器元素...');

        // 等待知乎写作页编辑器渲染完成（使用blog-auto-publishing-tools中的正确选择器）
        const titleInput = await waitFor('textarea[placeholder*="请输入标题"], textarea[placeholder*="输入文章标题"], textarea[placeholder*="标题"], input[placeholder*="请输入标题"], input[placeholder*="输入文章标题"], input[placeholder*="标题"], .WriteIndex-titleInput textarea, .WriteIndex-titleInput input, .TitleInput textarea, .TitleInput input', 30000);
        const editor = await waitFor('.DraftEditor-editorContainer [contenteditable="true"], [contenteditable="true"]', 30000);

        logger.log('[AIFA] 找到的元素 - 标题输入框:', !!titleInput, '编辑器:', !!editor);

        if (!titleInput || !editor) {
          // 若不是写作页，跳转到写作页后由页面端重试消息
          if (location.host !== 'zhuanlan.zhihu.com' || !location.pathname.startsWith('/write')) {
            logger.log('[AIFA] 不是写作页，跳转到写作页');
            location.href = 'https://zhuanlan.zhihu.com/write';
            return;
          }
          throw new Error('找不到知乎编辑器元素，请确认已进入写作页');
        }

        // 使用blog-auto-publishing-tools的填充方式
        logger.log('[AIFA] 开始填充内容...');

        // 填标题 - 使用blog-auto-publishing-tools原版逻辑
        if (payload && payload.title) {
          logger.log('[AIFA] 开始填充标题:', payload.title);
          await fillTitle(payload.title);
        }

        // 填正文 - 使用blog-auto-publishing-tools复制粘贴策略
        if (payload && payload.content) {
          logger.log('[AIFA] 开始填充正文内容');
          await fillContent(payload.content);
        }

        logger.log('[AIFA] 内容填充完成');

        // 可选自动发布
        await tryClickPublish(!!autoPublish);

        sendResult(currentTaskResponseWindow || e.source || window.opener || window, 'success', { url: location.href, taskId });

      } catch (err) {
        console.error('[AIFA] 任务处理失败:', err);
        sendResult(currentTaskResponseWindow || e.source || window.opener || window, 'failed', {
          error: (err && err.message) || String(err),
          taskId
        });
        persistPendingTaskRecord({
          taskId,
          status: 'failed',
          errorMessage: (err && err.message) || String(err),
          targetOrigin: currentTaskResponseOrigin
        });
      } finally {
        // 重置处理标志
        isProcessingTask = false;
        lastTaskId = null;
        currentTaskId = null;
        currentTaskResponseWindow = null;
        currentTaskResponseOrigin = '*';
        clearPendingTaskRecord();
        logger.log('[AIFA] 任务处理完成，重置标志');
      }
    } catch (err) {
      console.error('[AIFA] 消息处理异常:', err);
      sendResult(currentTaskResponseWindow || e.source || window.opener || window, 'failed', {
        error: '消息处理异常: ' + String(err),
        taskId: currentTaskId
      });
      persistPendingTaskRecord({
        taskId: currentTaskId,
        status: 'failed',
        errorMessage: '消息处理异常: ' + String(err),
        targetOrigin: currentTaskResponseOrigin
      });
      // 确保在异常情况下也重置标志
      isProcessingTask = false;
      lastTaskId = null;
      currentTaskId = null;
      currentTaskResponseWindow = null;
      currentTaskResponseOrigin = '*';
      clearPendingTaskRecord();
    }
  });

  // 兜底：拦截弹窗，避免打断
  window.addEventListener('error', () => {}, true);
  window.addEventListener('unhandledrejection', () => {}, true);

  
  // 启动握手：通知打开者我们已就绪
  try {
    logger.log('[AIFA] 尝试发送握手消息...');

    // 方法1：通过window.opener（如果存在）
    if (window.opener) {
      logger.log('[AIFA] 通过window.opener发送握手');
      window.opener.postMessage({ type: 'AIFA_READY', platform: 'zhihu' }, '*');
    }

  } catch (error) {
    console.error('[AIFA] 握手发送失败:', error);
  }
})();