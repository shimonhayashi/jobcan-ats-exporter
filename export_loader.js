(async function() {
  if (!location.hostname.includes('ats.jobcan.jp')) {
    alert('ジョブカン採用管理（ats.jobcan.jp）の画面で実行してください。');
    return;
  }

  // 画面上にプログレスUIを表示
  const overlayId = 'jbc_ai_interview_exporter_ui';
  let overlay = document.getElementById(overlayId);
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = overlayId;
  overlay.style.cssText = `
    position: fixed; top: 20px; right: 20px; width: 340px; z-index: 999999;
    background: #ffffff; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.25);
    padding: 18px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #333; font-size: 13px; border: 1px solid #e2e8f0;
  `;
  overlay.innerHTML = `
    <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px; color: #1e293b;">
      🤖 AI面接データ一括エクスポート
    </div>
    <div id="jbc_exp_status" style="margin-bottom: 10px; color: #475569;">準備中...</div>
    <div style="background: #e2e8f0; border-radius: 4px; height: 8px; overflow: hidden; margin-bottom: 12px;">
      <div id="jbc_exp_bar" style="background: #2563eb; width: 0%; height: 100%; transition: width 0.2s;"></div>
    </div>
    <button id="jbc_exp_close" style="display: none; width: 100%; padding: 6px 0; background: #2563eb; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">閉じる</button>
  `;
  document.body.appendChild(overlay);

  const statusEl = document.getElementById('jbc_exp_status');
  const barEl = document.getElementById('jbc_exp_bar');
  const closeBtn = document.getElementById('jbc_exp_close');
  closeBtn.onclick = () => overlay.remove();

  const updateProgress = (text, percent) => {
    statusEl.innerText = text;
    barEl.style.width = percent + '%';
  };

  try {
    updateProgress('面接一覧を取得中...', 5);

    // 1. 一覧取得
    let targetPage = 1;
    const limit = 50;
    const allInterviews = [];

    while (true) {
      const res = await fetch(`/_/configs/ai_interview_configs/ai_interviews?target_page=${targetPage}&limit=${limit}&sort_by=created_at&sort_order=desc`, {
        headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error('アクセス権限がありません（管理者または採用担当者アカウントで実行してください）');
        throw new Error(`一覧取得エラー: HTTP ${res.status}`);
      }
      const data = await res.json();
      const items = data.items || [];
      const totalCount = data.total_count || 0;
      allInterviews.push(...items);

      updateProgress(`一覧取得中: ${allInterviews.length} / ${totalCount} 件`, Math.min(20, Math.floor(allInterviews.length / (totalCount || 1) * 20)));

      if (allInterviews.length >= totalCount || items.length === 0) break;
      targetPage++;
      await new Promise(r => setTimeout(r, 100));
    }

    if (allInterviews.length === 0) {
      updateProgress('対象のAI面接データがありませんでした。', 100);
      closeBtn.style.display = 'block';
      return;
    }

    const totalTarget = allInterviews.length;
    updateProgress(`詳細取得中 (0 / ${totalTarget} 件)...`, 20);

    // 2. 詳細・候補者情報の並行取得 (並行数5)
    const concurrency = 5;
    const records = [];
    let completed = 0;

    const fetchDetail = async (item) => {
      const candId = item.candidate_id;
      let interviewDetail = null;
      let candidateDetail = null;

      if (candId) {
        try {
          const r1 = await fetch(`/_/ai_interviews/${candId}`, {
            headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
          });
          if (r1.ok) interviewDetail = await r1.json();
        } catch (e) {}

        try {
          const r2 = await fetch(`/_/candidates/${candId}`, {
            headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
          });
          if (r2.ok) candidateDetail = await r2.json();
        } catch (e) {}
      }

      let aiSummary = '';
      const qaBlocks = [];
      let videoUrl = '';

      if (interviewDetail) {
        videoUrl = interviewDetail.videoUrl || '';
        aiSummary = (interviewDetail.answer && interviewDetail.answer.answer) || '';
        const texts = (interviewDetail.transcription && interviewDetail.transcription.texts) || [];
        texts.forEach((t, i) => {
          let block = `【${t.heading || '質問' + (i + 1)}】\n回答: ${t.text || ''}`;
          (t.deepQuestions || []).forEach(dq => {
            block += `\n  - 深掘り質問: ${dq.question || ''}\n    回答: ${dq.answer || ''}`;
          });
          qaBlocks.push(block);
        });
      }

      let jobOfferName = '';
      let currentStepName = '';
      let candidateStatus = '';
      let pathName = '';
      let applicationDate = '';

      if (candidateDetail) {
        jobOfferName = (candidateDetail.job_offer && candidateDetail.job_offer.name) || '';
        candidateStatus = candidateDetail.status || '';
        applicationDate = candidateDetail.application_date || '';
        currentStepName = (candidateDetail.current_step && candidateDetail.current_step.name) || '';
        pathName = (candidateDetail.path && candidateDetail.path.name) || '';
      }

      return {
        candidate_id: candId,
        candidate_name: item.candidate_name,
        interview_status: item.status,
        topic_id: item.interview_type_id,
        score: item.score,
        max_score: item.max_score,
        data_1_score: item.data_1_score,
        data_2_score: item.data_2_score,
        data_3_score: item.data_3_score,
        data_4_score: item.data_4_score,
        completed_at: item.completed_at,
        job_offer_name: jobOfferName,
        current_step_name: currentStepName,
        candidate_status: candidateStatus,
        path_name: pathName,
        application_date: applicationDate,
        ai_summary: aiSummary,
        qa_transcription: qaBlocks.join('\n\n'),
        video_url: videoUrl
      };
    };

    // ワーカースレッド風実行
    const queue = [...allInterviews];
    const workers = Array.from({ length: concurrency }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        const rec = await fetchDetail(item);
        records.push(rec);
        completed++;
        const pct = 20 + Math.floor((completed / totalTarget) * 75);
        updateProgress(`詳細取得中: ${completed} / ${totalTarget} 件`, pct);
      }
    });

    await Promise.all(workers);

    // ID降順
    records.sort((a, b) => (b.candidate_id || 0) - (a.candidate_id || 0));

    updateProgress('CSVファイル生成中...', 95);

    // CSV生成
    const fields = [
      ['candidate_id', '候補者ID'],
      ['candidate_name', '候補者名'],
      ['interview_status', '面接状態'],
      ['topic_id', '面接トピックID'],
      ['score', '総合スコア'],
      ['max_score', '最大スコア'],
      ['data_1_score', '評価軸1スコア'],
      ['data_2_score', '評価軸2スコア'],
      ['data_3_score', '評価軸3スコア'],
      ['data_4_score', '評価軸4スコア'],
      ['completed_at', '面接完了日時'],
      ['job_offer_name', '求人名'],
      ['current_step_name', '現ステップ'],
      ['candidate_status', '候補者選考状態'],
      ['path_name', '応募経路'],
      ['application_date', '応募日'],
      ['ai_summary', 'AI要約'],
      ['qa_transcription', '文字起こし・Q&A全文'],
      ['video_url', '面接動画URL']
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    let csvContent = '\uFEFF'; // BOM
    csvContent += fields.map(f => `"${f[1]}"`).join(',') + '\r\n';

    records.forEach(r => {
      const row = fields.map(f => escapeCsv(r[f[0]]));
      csvContent += row.join(',') + '\r\n';
    });

    // 自動ダウンロード
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ts = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    a.href = url;
    a.download = `ai_interviews_${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    updateProgress(`完了！全 ${records.length} 件をダウンロードしました`, 100);
    barEl.style.background = '#10b981';
    closeBtn.style.display = 'block';

  } catch (err) {
    console.error(err);
    updateProgress(`エラー: ${err.message}`, 100);
    barEl.style.background = '#ef4444';
    closeBtn.style.display = 'block';
  }
})();
