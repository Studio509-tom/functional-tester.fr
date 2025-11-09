<?php
/**
 * UnitTestSuiteController
 *
 * CRUD and execution for UI-configurable HTTP tests.
 */
namespace App\Controller;

use App\Entity\UnitTestSuite;
use App\Form\UnitTestSuiteType;
use App\Repository\UnitTestSuiteRepository;
use App\Service\UnitTestRunner;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/unit-tests')]
class UnitTestSuiteController extends AbstractController
{
    #[Route('/', name: 'unit_index', methods: ['GET'])]
    public function index(UnitTestSuiteRepository $repo): Response
    {
        return $this->render('unit/index.html.twig', [
            'suites' => $repo->findBy([], ['id' => 'DESC'])
        ]);
    }

    #[Route('/new', name: 'unit_new', methods: ['GET','POST'])]
    public function new(Request $req, EntityManagerInterface $em): Response
    {
        $suite = new UnitTestSuite();
        $form = $this->createForm(UnitTestSuiteType::class, $suite);
        $form->handleRequest($req);
        if ($form->isSubmitted() && $form->isValid()) {
            // Ensure subfolders for the selected parent folder
            $parentFolder = $suite->getFolder();
            if ($parentFolder) {
                $parentFolder->ensureTestSubfolders();
                $em->persist($parentFolder);
            }

            // Basic JSON validation
            try { json_decode($suite->getTestsJson(), true, 512, JSON_THROW_ON_ERROR); }
            catch (\Throwable $e) {
                $this->addFlash('danger', 'JSON invalide: ' . $e->getMessage());
                return $this->render('unit/new.html.twig', ['form' => $form->createView()]);
            }
            $em->persist($suite);
            $em->flush();
            return $this->redirectToRoute('unit_show', ['id' => $suite->getId()]);
        }
        return $this->render('unit/new.html.twig', ['form' => $form->createView()]);
    }

    #[Route('/{id}', name: 'unit_show', methods: ['GET'])]
    public function show(UnitTestSuite $suite): Response
    {
        return $this->render('unit/show.html.twig', [ 'suite' => $suite ]);
    }

    #[Route('/{id}/edit', name: 'unit_edit', methods: ['GET','POST'])]
    public function edit(UnitTestSuite $suite, Request $req, EntityManagerInterface $em): Response
    {
        $form = $this->createForm(UnitTestSuiteType::class, $suite);
        $form->handleRequest($req);
        if ($form->isSubmitted() && $form->isValid()) {
            try { json_decode($suite->getTestsJson(), true, 512, JSON_THROW_ON_ERROR); }
            catch (\Throwable $e) {
                $this->addFlash('danger', 'JSON invalide: ' . $e->getMessage());
                return $this->render('unit/edit.html.twig', ['form' => $form->createView(), 'suite' => $suite]);
            }
            $em->flush();
            return $this->redirectToRoute('unit_show', ['id' => $suite->getId()]);
        }
        return $this->render('unit/edit.html.twig', ['form' => $form->createView(), 'suite' => $suite]);
    }

    #[Route('/{id}/delete', name: 'unit_delete', methods: ['POST'])]
    public function delete(UnitTestSuite $suite, Request $req, EntityManagerInterface $em): Response
    {
        if ($this->isCsrfTokenValid('del_u_'.$suite->getId(), $req->request->get('_token'))) {
            $em->remove($suite);
            $em->flush();
        }
        return $this->redirectToRoute('unit_index');
    }

    #[Route('/{id}/run', name: 'unit_run', methods: ['POST'])]
    public function run(UnitTestSuite $suite, UnitTestRunner $runner): Response
    {
        $tests = [];
        try { $tests = json_decode($suite->getTestsJson(), true, 512, JSON_THROW_ON_ERROR); }
        catch (\Throwable $e) {
            $this->addFlash('danger', 'JSON invalide: ' . $e->getMessage());
            return $this->redirectToRoute('unit_show', ['id' => $suite->getId()]);
        }
        if (!is_array($tests)) $tests = [];
        $result = $runner->run($tests);
        return $this->render('unit/report.html.twig', [
            'suite' => $suite,
            'result' => $result,
        ]);
    }
}
