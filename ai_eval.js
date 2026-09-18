(async function() {
  // 1. 候補者ID抽出
  const match = location.pathname.match(/\/candidates\/(\d+)/);
  let candidateId = match ? match[1] : null;

  if (!candidateId) {
    candidateId = prompt('ジョブカンの候補者詳細画面（/candidates/ID）で実行するか、候補者IDを入力してください:');
    if (!candidateId) return;
  }

  const overlayId = 'jbc_ai_eval_poster_modal';
  let overlay = document.getElementById(overlayId);
  if (overlay) overlay.remove();

  // 候補者情報をATSから取得
  let candidateName = '取得中...';
  let currentStepName = '一次面接';
  let jobOfferName = '';

  try {
    const res = await fetch(`/_/candidates/${candidateId}`, {
      headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
    });
    if (res.ok) {
      const data = await res.json();
      candidateName = data.name || `候補者 #${candidateId}`;
      jobOfferName = (data.job_offer && data.job_offer.name) || '';
      currentStepName = (data.current_step && data.current_step.name) || '面接フェーズ';
    }
  } catch (e) {
    console.error('候補者情報取得失敗:', e);
  }

  // UIモーダル構築
  overlay = document.createElement('div');
  overlay.id = overlayId;
  overlay.style.cssText = `
    position: fixed; top: 20px; right: 20px; width: 560px; max-height: 92vh;
    background: #ffffff; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.35);
    padding: 22px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", sans-serif;
    color: #1e293b; font-size: 13px; z-index: 9999999; display: flex; flex-direction: column;
    border: 1px solid #cbd5e1; box-sizing: border-box;
  `;

  overlay.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 12px;">
      <div>
        <div style="font-weight: bold; font-size: 16px; color: #0f172a; display: flex; align-items: center; gap: 8px;">
          <span>📝</span> AI面接評価＆西村氏上申書生成
        </div>
        <div style="font-size: 12px; color: #64748b; margin-top: 3px;">
          対象: <b style="color: #0f172a;">${candidateName}</b> (ID: ${candidateId}) ｜ 求人: ${jobOfferName || '未指定'} ｜ 現フェーズ: <span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${currentStepName}</span>
        </div>
      </div>
      <button id="jbc_modal_close" style="background: none; border: none; font-size: 24px; line-height: 1; cursor: pointer; color: #94a3b8; padding: 0 4px;">&times;</button>
    </div>

    <div style="overflow-y: auto; flex: 1; padding-right: 4px;">
      <!-- フェーズ指定 -->
      <div style="margin-bottom: 10px;">
        <label style="font-weight: bold; font-size: 12px; display: block; margin-bottom: 3px;">面接フェーズ（見出しに反映）:</label>
        <input id="jbc_input_step" type="text" value="${currentStepName}" style="width: 100%; box-sizing: border-box; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
      </div>

      <!-- Google Docs URL or テキスト入力 -->
      <div style="margin-bottom: 12px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
        <label style="font-weight: bold; font-size: 12px; display: block; margin-bottom: 4px; color: #1e293b;">
          Google Meet 文字起こし（Docs URL または テキスト）:
        </label>
        <div style="display: flex; gap: 6px; margin-bottom: 8px;">
          <input id="jbc_doc_url" type="text" placeholder="https://docs.google.com/document/d/..." style="flex: 1; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px;">
          <button id="jbc_btn_open_doc" style="background: #e2e8f0; color: #334155; border: none; padding: 6px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: bold;">Docsを開く ↗</button>
          <button id="jbc_btn_paste_clip" style="background: #2563eb; color: #fff; border: none; padding: 6px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: bold;">📋 貼付</button>
        </div>
        <textarea id="jbc_input_transcript" placeholder="文字起こしテキスト（またはDocsでCmd+A→Cmd+Cして上の「貼付」を押す）..." style="width: 100%; height: 110px; box-sizing: border-box; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; font-family: monospace; resize: vertical;"></textarea>
      </div>

      <!-- Gemini APIキー入力 -->
      <div style="margin-bottom: 12px; background: #fffbeb; padding: 10px 12px; border-radius: 6px; border: 1px solid #fde68a;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <label style="font-weight: bold; font-size: 11px; color: #92400e;">🔑 Gemini APIキー (初回のみ入力・自動保存):</label>
          <a href="https://aistudio.google.com/app/apikey" target="_blank" style="font-size: 11px; color: #2563eb; text-decoration: underline; font-weight: bold;">無料キー取得 ↗</a>
        </div>
        <input id="jbc_gemini_key" type="password" placeholder="AIzaSy... (Google AI Studioで作成した無料キー)" style="width: 100%; box-sizing: border-box; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 11px;">
      </div>

      <button id="jbc_btn_run_generate" style="width: 100%; background: #2563eb; color: #fff; font-weight: bold; padding: 10px 0; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(37,99,235,0.25);">
        ✨ アルサーガ基準で評価＆上申書を生成
      </button>

      <!-- プレビュー領域 -->
      <div id="jbc_box_preview" style="display: none;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <label style="font-weight: bold; font-size: 12px; color: #059669;">
            生成プレビュー（修正可能・このままATSに反映されます）:
          </label>
          <span style="font-size: 11px; color: #64748b;">※自由に編集できます</span>
        </div>
        <textarea id="jbc_text_preview" style="width: 100%; height: 220px; box-sizing: border-box; padding: 8px; border: 2px solid #10b981; border-radius: 6px; font-size: 12px; font-family: monospace; line-height: 1.4; resize: vertical;"></textarea>

        <button id="jbc_btn_submit_ats" style="width: 100%; background: #059669; color: #fff; font-weight: bold; padding: 12px 0; border: none; border-radius: 6px; cursor: pointer; font-size: 15px; margin-top: 10px; box-shadow: 0 4px 14px rgba(5,150,105,0.35);">
          📝 ジョブカンタイムラインに反映する
        </button>
      </div>

      <div id="jbc_msg_status" style="margin-top: 10px; font-size: 12px; text-align: center; color: #64748b;"></div>
    </div>
  `;

  document.body.appendChild(overlay);

  // イベント設定
  const closeBtn = document.getElementById('jbc_modal_close');
  const stepInput = document.getElementById('jbc_input_step');
  const docUrlInput = document.getElementById('jbc_doc_url');
  const openDocBtn = document.getElementById('jbc_btn_open_doc');
  const pasteClipBtn = document.getElementById('jbc_btn_paste_clip');
  const transcriptArea = document.getElementById('jbc_input_transcript');
  const generateBtn = document.getElementById('jbc_btn_run_generate');
  const previewBox = document.getElementById('jbc_box_preview');
  const previewArea = document.getElementById('jbc_text_preview');
  const submitAtsBtn = document.getElementById('jbc_btn_submit_ats');
  const statusMsg = document.getElementById('jbc_msg_status');
  const geminiKeyInput = document.getElementById('jbc_gemini_key');
  const savedKey = localStorage.getItem('jbc_gemini_api_key') || '';
  if (savedKey) geminiKeyInput.value = savedKey;
  geminiKeyInput.onchange = () => {
    localStorage.setItem('jbc_gemini_api_key', geminiKeyInput.value.trim());
  };

  closeBtn.onclick = () => overlay.remove();

  openDocBtn.onclick = () => {
    const url = docUrlInput.value.trim();
    if (!url) {
      alert('Google DocsのURLを入力してください');
      return;
    }
    window.open(url, '_blank');
  };

  // クリップボードから貼付
  pasteClipBtn.onclick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        transcriptArea.value = text;
        statusMsg.innerText = `クリップボードから文字起こし（${text.length}文字）を貼り付けました。`;
        statusMsg.style.color = '#059669';
      } else {
        alert('クリップボードが空です。DocsでCmd+A→Cmd+Cしてから押してください。');
      }
    } catch (e) {
      alert('クリップボードの読み取り権限がありません。下のテキストエリアに直接Cmd+Vで貼り付けてください。');
    }
  };

  // AI生成実行
  generateBtn.onclick = async () => {
    const transcript = transcriptArea.value.trim();
    if (!transcript) {
      alert('文字起こしテキストを入力（または貼付）してください。');
      return;
    }

    const apiKey = geminiKeyInput.value.trim() || localStorage.getItem('jbc_gemini_api_key');
    if (!apiKey) {
      alert('Gemini APIキーを入力してください。（入力欄右上のリンクから無料で取得できます）');
      geminiKeyInput.focus();
      return;
    }
    localStorage.setItem('jbc_gemini_api_key', apiKey);

    generateBtn.disabled = true;
    generateBtn.style.background = '#94a3b8';
    generateBtn.innerText = '⏳ アルサーガ評価基準で解析中... (約15〜25秒)';
    statusMsg.innerText = 'Gemini 2.0 Flash で能力特性・根拠・上申サマリーを生成中...';
    statusMsg.style.color = '#2563eb';

    const phaseName = stepInput.value.trim() || '面接';

    const promptText = `
あなたは一流の人事担当者です。
株式会社DONUTSの公式採用評価ロジックに基づき、以下の「面接文字起こし」を分析し、能力特性評価（4項目・各100点満点）、情報収集要約、および役員（西村氏）向け上申レポートを作成してください。

## 評価基準（アルサーガ公式評価ロジック）
- 採点指針: 20点〜100点の5点刻みで評価。
  - 100点: 卓越した模範レベル
  - 85〜90点: 大多数の基準を高度に満たし、高い実績を示す
  - 70〜80点: 基準を高いレベルで満たし、安定した能力
  - 65点: 実務遂行に十分な能力
  - 40〜50点: 基準を満たしておらず改善が必要
- **【最重要】点数の根拠となる発言引用・事実を必ず詳細に明記すること。** 具体性がなかったり説明が不十分な箇所は基準を満たしていないと判定してください。

## 評価4項目（各100点満点）
1. コミュニケーション能力: 質問意図の正確な理解、簡潔さと詳細さのバランス、具体的エピソード、相手に寄り添う姿勢、相談・協力の柔軟さ
2. モチベーションと熱意: 明確なキャリア目標、挑戦・成長意欲、周囲への好影響、高い目標と具体的行動計画、粘り強さ
3. スキル: 業務に必要な知識・即戦力性、新しい知識の習得意欲、問題解決能力と創造的思考力
4. リーダーシップ: 目標達成、困難時のメンバー支援・リカバリー、他者を巻き込む姿勢

## 情報収集要約4項目
- 転職理由
- 志望動機
- 他社選考状況
- 希望条件

## 候補者情報
- 氏名: ${candidateName}
- 求人: ${jobOfferName || '未指定'}
- 実施フェーズ: ${phaseName}

## 面接文字起こしテキスト
${transcript.slice(0, 32000)}

## 出力フォーマット（マークダウン）
前置きや挨拶は一切出力せず、以下のフォーマットのみを出力してください。

【${phaseName} AI評価・上申レポート】（実施日: ${new Date().toLocaleDateString('ja-JP')}）

■ 総合判定: [合格推奨 / 条件付き合格 / 見送り推奨]
■ 総合スコア: [4項目の合計]/400点

---

### 1. 能力特性評価（各100点満点・根拠詳細）

・コミュニケーション能力: [点数]/100点
  [理由・根拠となる発言引用と詳細分析]

・モチベーションと熱意: [点数]/100点
  [理由・根拠となる発言引用と詳細分析]

・スキル: [点数]/100点
  [理由・根拠となる発言引用と詳細分析]

・リーダーシップ: [点数]/100点
  [理由・根拠となる発言引用と詳細分析]

### 2. 強みと弱み（見極めポイント）
- **強み**: [客観的な強み2〜3点]
- **弱み・懸念点**: [実務上の懸念点]
- **次フェーズへの申し送り・確認事項**: [評価漏れ防止のための未確認事項]

### 3. 情報収集要約
- **転職理由**: [要約]
- **志望動機**: [要約]
- **他社選考状況**: [要約]
- **希望条件**: [要約]

### 4. 西村氏（役員）向け上申サマリー
- **上申結論**: [Pass（合格推奨） / Hold（保留） / Fail（見送り）]
- **推薦理由（要点3行）**:
  1. [即戦力性・スキル]
  2. [カルチャーフィット・自走力]
  3. [事業貢献の見込み]
- **懸念点と入社後フォロー策**: [懸念点への対応方針]
- **想定年収感・処遇メモ**: [記載]
`;

    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { temperature: 0.2 }
        })
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error?.message || `HTTP ${resp.status}`);
      }

      const resJson = await resp.json();
      const generatedText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';

      previewArea.value = generatedText.trim();
      previewBox.style.display = 'block';
      statusMsg.innerText = '✅ 生成完了！内容を確認・編集し、下のボタンでタイムラインに投稿してください。';
      statusMsg.style.color = '#059669';

    } catch (err) {
      console.error(err);
      alert('AI評価生成エラー: ' + err.message);
      statusMsg.innerText = 'エラー: ' + err.message;
      statusMsg.style.color = '#dc2626';
    } finally {
      generateBtn.disabled = false;
      generateBtn.style.background = '#2563eb';
      generateBtn.innerText = '✨ アルサーガ基準で評価＆上申書を生成';
    }
  };

  // ジョブカンタイムラインへの投稿
  submitAtsBtn.onclick = async () => {
    const finalContent = previewArea.value.trim();
    if (!finalContent) {
      alert('投稿内容が空です。');
      return;
    }

    if (!confirm('この評価レポートをジョブカンタイムラインに投稿しますか？')) {
      return;
    }

    submitAtsBtn.disabled = true;
    submitAtsBtn.innerText = '⏳ ジョブカンに反映中...';

    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
      const postRes = await fetch('/_/candidate_comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': csrfToken,
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          candidate_id: parseInt(candidateId, 10),
          content: finalContent
        })
      });

      if (!postRes.ok) {
        const errJson = await postRes.json().catch(() => ({}));
        throw new Error(errJson.message || `HTTP ${postRes.status}`);
      }

      alert('🎉 ジョブカンのタイムラインに正常に反映されました！');
      overlay.remove();
      location.reload();

    } catch (err) {
      console.error(err);
      alert('ジョブカンへの投稿に失敗しました: ' + err.message);
      submitAtsBtn.disabled = false;
      submitAtsBtn.innerText = '📝 ジョブカンタイムラインに反映する';
    }
  };

})();
