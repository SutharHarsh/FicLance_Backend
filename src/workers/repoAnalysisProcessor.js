const simpleGit = require('simple-git');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { Portfolio } = require('../models');
const logger = require('../config/logger');

/**
 * Process repository analysis jobs
 * @param {Object} job - BullMQ job
 * @returns {Promise<any>} Job result
 */
async function processRepoAnalysisJob(job) {
  const { portfolioId } = job.data;
  
  logger.info(`Processing repo analysis job: ${job.id}`, { portfolioId });

  let tempDir = null;

  try {
    // Get portfolio
    const portfolio = await Portfolio.findById(portfolioId);
    if (!portfolio) {
      throw new Error(`Portfolio not found: ${portfolioId}`);
    }

    // Update status to running
    portfolio.status = 'running';
    await portfolio.save();

    // Create temp directory for cloning
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-analysis-'));

    // Clone repository (shallow clone)
    logger.info(`Cloning repository: ${portfolio.repoUrl}`);
    const git = simpleGit();
    await git.clone(portfolio.repoUrl, tempDir, ['--depth', '1', '--branch', portfolio.branch]);

    // Run analysis
    const analysisResults = await analyzeRepository(tempDir, portfolio);

    // Update portfolio with results
    portfolio.analysisMeta = analysisResults.analysisMeta;
    portfolio.fileCount = analysisResults.fileCount;
    portfolio.sizeBytes = analysisResults.sizeBytes;
    portfolio.toolchain = analysisResults.toolchain;
    portfolio.analyzedAt = new Date();
    portfolio.status = 'done';
    await portfolio.save();

    logger.info(`Repository analysis completed: ${portfolioId}`);

    return {
      portfolioId,
      status: 'done',
      results: analysisResults,
    };
  } catch (error) {
    logger.error(`Repository analysis failed: ${portfolioId}`, {
      error: error.message,
      stack: error.stack,
    });

    // Update portfolio with error
    const portfolio = await Portfolio.findById(portfolioId);
    if (portfolio) {
      portfolio.status = 'error';
      portfolio.analysisError = {
        code: error.code || 'ANALYSIS_FAILED',
        message: error.message,
        details: error.stack,
      };
      await portfolio.save();
    }

    throw error;
  } finally {
    // Cleanup temp directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        logger.debug(`Cleaned up temp directory: ${tempDir}`);
      } catch (error) {
        logger.warn(`Failed to cleanup temp directory: ${tempDir}`, error);
      }
    }
  }
}

/**
 * Analyze repository (basic implementation for local dev)
 * In production, this should invoke a Docker container with comprehensive analysis tools
 */
async function analyzeRepository(repoPath, portfolio) {
  const results = {
    fileCount: 0,
    sizeBytes: 0,
    analysisMeta: {
      languageBreakdown: [],
      testsFound: false,
      testsSummary: { total: 0, passing: 0, failing: 0 },
      ciConfigFound: false,
      lintIssuesCount: 0,
      securityFindings: [],
      readmePresent: false,
    },
    toolchain: {},
  };

  try {
    // Count files and detect languages
    const files = await getAllFiles(repoPath);
    results.fileCount = files.length;

    // Calculate total size
    let totalSize = 0;
    const languageCounts = {};

    for (const file of files) {
      try {
        const stats = await fs.stat(file);
        totalSize += stats.size;

        const ext = path.extname(file);
        const language = detectLanguage(ext);
        
        if (language) {
          languageCounts[language] = (languageCounts[language] || 0) + stats.size;
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    results.sizeBytes = totalSize;

    // Convert language counts to percentages
    results.analysisMeta.languageBreakdown = Object.entries(languageCounts).map(([language, bytes]) => ({
      language,
      bytes,
      percentage: totalSize > 0 ? Math.round((bytes / totalSize) * 100) : 0,
    })).sort((a, b) => b.bytes - a.bytes);

    // Check for README
    const readmeExists = files.some(f => path.basename(f).toLowerCase().match(/^readme\.(md|txt)$/));
    results.analysisMeta.readmePresent = readmeExists;

    // Check for test directories
    const hasTests = files.some(f => 
      f.includes('/test/') || 
      f.includes('/tests/') || 
      f.includes('/__tests__/') ||
      f.includes('.test.') ||
      f.includes('.spec.')
    );
    results.analysisMeta.testsFound = hasTests;

    // Check for CI config
    const ciConfigFound = files.some(f => {
      const basename = path.basename(f);
      return basename === '.travis.yml' ||
        basename === '.gitlab-ci.yml' ||
        basename === 'circle.yml' ||
        f.includes('.github/workflows/');
    });
    results.analysisMeta.ciConfigFound = ciConfigFound;

    // Detect package.json for Node.js projects
    if (files.some(f => path.basename(f) === 'package.json')) {
      results.toolchain.testRunner = 'npm/jest';
    }

    logger.info(`Repository analysis complete for ${portfolio.normalizedRepo}`, {
      fileCount: results.fileCount,
      sizeBytes: results.sizeBytes,
      languages: results.analysisMeta.languageBreakdown.map(l => l.language).join(', '),
    });

    return results;
  } catch (error) {
    logger.error('Error analyzing repository:', error);
    throw error;
  }
}

/**
 * Get all files in a directory recursively
 */
async function getAllFiles(dir, fileList = []) {
  const files = await fs.readdir(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    
    // Skip .git directory
    if (file === '.git') continue;

    try {
      const stat = await fs.stat(filePath);
      
      if (stat.isDirectory()) {
        await getAllFiles(filePath, fileList);
      } else {
        fileList.push(filePath);
      }
    } catch (error) {
      // Skip files/dirs that can't be accessed
    }
  }

  return fileList;
}

/**
 * Detect programming language from file extension
 */
function detectLanguage(ext) {
  const languageMap = {
    '.js': 'JavaScript',
    '.jsx': 'JavaScript',
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript',
    '.py': 'Python',
    '.java': 'Java',
    '.cpp': 'C++',
    '.c': 'C',
    '.go': 'Go',
    '.rs': 'Rust',
    '.rb': 'Ruby',
    '.php': 'PHP',
    '.swift': 'Swift',
    '.kt': 'Kotlin',
    '.cs': 'C#',
    '.html': 'HTML',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.json': 'JSON',
    '.md': 'Markdown',
    '.yml': 'YAML',
    '.yaml': 'YAML',
    '.sh': 'Shell',
  };

  return languageMap[ext.toLowerCase()] || null;
}

module.exports = {
  processRepoAnalysisJob,
  analyzeRepository,
};
