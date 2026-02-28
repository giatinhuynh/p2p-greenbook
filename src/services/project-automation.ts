import { Octokit } from '@octokit/rest'

type GitHubApiError = {
  status: number
  response?: {
    data?: {
      errors?: Array<{ message: string }>
    }
  }
}

const isGitHubError = (err: unknown): err is GitHubApiError =>
  typeof err === 'object' &&
  err !== null &&
  'status' in err &&
  typeof (err as GitHubApiError).status === 'number' &&
  (!('response' in err) || (
    typeof (err as GitHubApiError).response === 'object' &&
    (!('data' in ((err as GitHubApiError).response ?? {})) || 
     typeof ((err as GitHubApiError).response?.data) === 'object')
  ))

export class ProjectAutomationService {
  private octokit: Octokit
  private currentRepoUrl: string | null = null

  constructor() {
    if (!process.env.GITHUB_ACCESS_TOKEN) {
      throw new Error('GITHUB_ACCESS_TOKEN is required')
    }

    this.octokit = new Octokit({
      auth: process.env.GITHUB_ACCESS_TOKEN
    })
  }

  async createGithubRepository(projectName: string): Promise<string> {
    try {
      const repoName = `greenbook-${projectName.toLowerCase().replace(/\s+/g, '-')}`
      let attempt = 0
      let created = false
      let repo

      while (!created && attempt < 5) {
        try {
          const response = await this.octokit.repos.createForAuthenticatedUser({
            name: attempt === 0 ? repoName : `${repoName}-${attempt}`,
            private: true,
            auto_init: true
          })
          repo = response.data
          created = true
        } catch (error: unknown) {
          if (isGitHubError(error) && error.status === 422 && error.response?.data?.errors?.[0]?.message === 'name already exists on this account') {
            attempt++
          } else {
            throw error
          }
        }
      }

      if (!created || !repo) {
        throw new Error('Failed to create repository after multiple attempts')
      }

      // Store the repository URL before returning it
      this.currentRepoUrl = repo.html_url
      console.log('Stored repository URL:', this.currentRepoUrl)

      // Wait a moment for the repository to be fully initialized
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Get all content from the boilerplate repository recursively
      const getAllContent = async (path = '') => {
        console.log(`Fetching content from path: ${path}`)
        try {
          const { data: content } = await this.octokit.repos.getContent({
            owner: process.env.GITHUB_ORG!,
            repo: 'GreenBook-Boilerplate',
            path
          })

          if (Array.isArray(content)) {
            for (const item of content) {
              if (item.type === 'dir') {
                // Recursively get content of directories
                await getAllContent(item.path)
              } else if (item.type === 'file') {
                // Get the file content from template
                const { data: fileData } = await this.octokit.repos.getContent({
                  owner: process.env.GITHUB_ORG!,
                  repo: 'GreenBook-Boilerplate',
                  path: item.path
                })

                // Check if file exists in target repo and get SHA if it does
                let sha: string | undefined
                try {
                  const { data: existingFile } = await this.octokit.repos.getContent({
                    owner: repo.owner.login,
                    repo: repo.name,
                    path: item.path
                  })
                  if ('sha' in existingFile) {
                    sha = existingFile.sha
                  }
                } catch (error: unknown) {
                  if (isGitHubError(error) && error.status !== 404) {
                    throw error
                  }
                  // File doesn't exist yet, which is fine
                }

                // Create or update the file
                try {
                  await this.octokit.repos.createOrUpdateFileContents({
                    owner: repo.owner.login,
                    repo: repo.name,
                    path: item.path,
                    message: `Add ${item.path} from boilerplate`,
                    content: typeof fileData === 'object' && 'content' in fileData ? fileData.content : '',
                    sha // Include SHA if file exists
                  })
                  console.log(`Successfully copied: ${item.path}`)
                } catch (error: unknown) {
                  console.error(`Error copying file ${item.path}:`, error)
                  if (isGitHubError(error) && error.status === 409) {
                    console.log(`Retrying ${item.path} due to conflict...`)
                    // Wait a moment and retry once
                    await new Promise(resolve => setTimeout(resolve, 1000))
                    await this.octokit.repos.createOrUpdateFileContents({
                      owner: repo.owner.login,
                      repo: repo.name,
                      path: item.path,
                      message: `Add ${item.path} from boilerplate`,
                      content: typeof fileData === 'object' && 'content' in fileData ? fileData.content : '',
                      sha
                    })
                  } else {
                    throw error
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error processing path ${path}:`, error)
          throw error
        }
      }

      // Start copying all content from root
      console.log('Starting to copy boilerplate content...')
      await getAllContent()
      console.log('Finished copying boilerplate content')

      return repo.html_url
    } catch (error) {
      console.error('GitHub repository creation error:', error)
      throw new Error('Failed to create GitHub repository')
    }
  }
}