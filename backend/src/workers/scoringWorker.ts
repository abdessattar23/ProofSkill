import { processQueue, QueueJob } from '../lib/queue';
import { evaluateAnswer } from '../services/interview';
import { getSupabase } from '../lib/supabase';

async function handle(job: QueueJob) {
    if (job.type !== 'score-answer') return;
    const { question_id, skill, question, transcript } = job.payload as any;
    const evalResult = await evaluateAnswer(skill, question, transcript);
    const supabase = getSupabase();
    await supabase.from('interview_answers').insert({ question_id, transcript, score: evalResult.score, reasoning: evalResult.reasoning });
    console.log('Scored', job.id, evalResult.score);
}

processQueue(handle).catch(e => { console.error('Worker crashed', e); process.exit(1); });
