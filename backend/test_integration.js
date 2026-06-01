const { generateEmbedding } = require('./utils/embeddings');
const { answerQuestionWithContext } = require('./utils/chat');

async function testIntegration() {
  console.log('Testing generateEmbedding with gemini-embedding-2...');
  try {
    const text = 'Prometheus AI Site Intelligence';
    const embedding = await generateEmbedding(text);
    console.log(`✅ Embedding generated successfully! Dimensions: ${embedding.length}`);
    if (embedding.length === 3072) {
      console.log('✅ Matches expected gemini-embedding-2 dimensions (3072)!');
    }
  } catch (error) {
    console.error('❌ Embedding generation failed:', error.message);
  }

  console.log('\nTesting answerQuestionWithContext with gemini-flash-latest...');
  try {
    const query = 'What is Prometheus AI?';
    const context = [
      {
        url: 'https://prometheus-ai.io/about',
        title: 'About Prometheus AI',
        text: 'Prometheus AI is a Retrieval-Augmented Generation (RAG) platform that scrapes site maps and pages, segments them into chunk indices, and runs grounded Q&A and site summary generation.'
      }
    ];
    const answer = await answerQuestionWithContext(query, context);
    console.log(`✅ Chat generated successfully! Answer:\n"${answer}"`);
  } catch (error) {
    console.error('❌ Chat generation failed:', error.message);
  }
}

testIntegration();
