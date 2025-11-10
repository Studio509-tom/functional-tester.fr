<?php
namespace App\EventSubscriber;

use App\Entity\User;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

/**
 * Ensures default admin account exists (idempotent) at first request.
 */
class AdminBootstrapSubscriber implements EventSubscriberInterface
{
    private bool $checked = false;
    public function __construct(
        private readonly UserRepository $repo,
        private readonly EntityManagerInterface $em,
        private readonly UserPasswordHasherInterface $hasher,
    ) {}

    public static function getSubscribedEvents(): array
    {
        return [ KernelEvents::REQUEST => ['onRequest', 100] ];
    }

    public function onRequest(RequestEvent $event): void
    {
        if ($this->checked || !$event->isMainRequest()) return; // run once
        $this->checked = true;
        $existing = $this->repo->findOneBy(['email' => 'admin@admin.fr']);
        if ($existing) return;
        $admin = new User();
        $admin->setEmail('admin@admin.fr');
        $admin->setRoles(['ROLE_ADMIN']);
        $admin->setPassword($this->hasher->hashPassword($admin, 'admin'));
        $this->em->persist($admin);
        $this->em->flush();
    }
}
