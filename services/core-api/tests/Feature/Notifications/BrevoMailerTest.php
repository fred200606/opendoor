<?php

namespace Tests\Feature\Notifications;

use Illuminate\Support\Facades\Mail;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use Tests\TestCase;

/** Production mail goes through Brevo's HTTPS API (Railway blocks SMTP; decision 2026-10-15). */
class BrevoMailerTest extends TestCase
{
    public function test_mail_is_posted_to_the_brevo_api_with_the_key(): void
    {
        $requests = [];
        $this->app->instance(HttpClientInterface::class, new MockHttpClient(function (string $method, string $url, array $options) use (&$requests) {
            $requests[] = compact('method', 'url', 'options');

            return new MockResponse('{"messageId":"<1@smtp-relay.mailin.fr>"}', ['http_code' => 201]);
        }));
        config([
            'mail.default' => 'brevo',
            'mail.mailers.brevo.key' => 'test-brevo-key',
            'mail.from' => ['address' => 'opendoor.team@example.test', 'name' => 'OpenDoor'],
        ]);
        Mail::purge('brevo');

        Mail::raw('Your company is verified.', fn ($message) => $message->to('owner@example.test')->subject('Your company is verified'));

        $this->assertCount(1, $requests);
        $this->assertSame('POST', $requests[0]['method']);
        $this->assertSame('https://api.brevo.com/v3/smtp/email', $requests[0]['url']);
        $this->assertContains('api-key: test-brevo-key', $requests[0]['options']['headers']);
        $body = json_decode($requests[0]['options']['body'], true);
        $this->assertSame('opendoor.team@example.test', $body['sender']['email']);
        $this->assertSame('owner@example.test', $body['to'][0]['email']);
        $this->assertSame('Your company is verified', $body['subject']);
    }

    public function test_tests_and_local_development_do_not_use_brevo(): void
    {
        $this->assertSame('array', config('mail.default'));
    }
}
