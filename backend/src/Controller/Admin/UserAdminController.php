<?php
namespace App\Controller\Admin;

use App\Entity\User;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/admin/users')]
class UserAdminController extends AbstractController
{
    #[Route('/', name: 'admin_users', methods: ['GET'])]
    public function index(UserRepository $repo): Response
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');
        return $this->render('admin/users/index.html.twig', [
            'users' => $repo->findBy([], ['id' => 'DESC'])
        ]);
    }

    #[Route('/new', name: 'admin_users_new', methods: ['GET','POST'])]
    public function new(Request $req, EntityManagerInterface $em, UserPasswordHasherInterface $hasher): Response
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');
        if ($req->isMethod('POST')) {
            $email = trim((string)$req->request->get('email', ''));
            $password = (string)$req->request->get('password', '');
            $role = (string)$req->request->get('role', 'ROLE_USER');
            if (!$email || !$password) {
                $this->addFlash('danger', 'Email et mot de passe requis.');
            } else {
                $u = new User();
                $u->setEmail($email);
                $u->setRoles([$role]);
                $u->setPassword($hasher->hashPassword($u, $password));
                $em->persist($u);
                $em->flush();
                return $this->redirectToRoute('admin_users');
            }
        }
        return $this->render('admin/users/new.html.twig');
    }
}
