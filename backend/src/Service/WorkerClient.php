<?php
/**
 * WorkerClient
 *
 * Small HTTP client that talks to the Node/Express Puppeteer worker.
 * It allows Symfony to trigger scenario runs and to fetch generated artifacts
 * (like screenshots) through a backend-to-backend call.
 */
namespace App\Service;

use GuzzleHttp\Client;

class WorkerClient
{
    private string $base;
    private Client $http;
    /**
     * @param string $workerBaseUrl Base URL of the worker (e.g. http://127.0.0.1:4000)
     */
    public function __construct(string $workerBaseUrl) {
        $this->base = rtrim($workerBaseUrl, '/');
        $this->http = new Client(['base_uri' => $this->base, 'timeout' => 120]);
    }

    /**
     * Execute a list of steps via the worker
     * @param array $steps
     * @param array $options optional execution options (perStepScreenshot, retries, backoffMs, stepTimeoutMs, video)
     * @return array{success:bool, steps:array, errors:array, screenshotPath?:string, queuedMs?:int, durationMs?:int}
     */
    public function run(array $steps, array $options = []): array {
        $payload = ['steps' => $steps];
        if (!empty($options)) { $payload['options'] = $options; }
        $resp = $this->http->post('/run', [
            'json' => $payload,
        ]);
        return json_decode((string)$resp->getBody(), true);
    }

    public function getBaseUrl(): string { return $this->base; }

    /**
     * Fetch a resource from the worker (relative like "/output/.." or absolute URL).
     * @return array{body:string, contentType:string}
     */
    public function fetch(string $path): array
    {
        $resp = $this->http->get($path);
        $ct = $resp->getHeaderLine('Content-Type') ?: 'application/octet-stream';
        return ['body' => (string)$resp->getBody(), 'contentType' => $ct];
    }
}
