<?php
/**
 * ScenarioFolderController
 *
 * Manage folders (projects) that organize scenarios: list, show, create,
 * edit, delete, and deep-duplicate a folder with its hierarchy and scenarios.
 */
namespace App\Controller;

use App\Entity\ScenarioFolder;
use App\Repository\TestScenarioRepository;
use App\Service\FolderDuplicator;
use App\Form\ScenarioFolderType;
use App\Repository\ScenarioFolderRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/folders')]
class ScenarioFolderController extends AbstractController
{
    #[Route('/{id}', name: 'folder_show', methods: ['GET'])]
    /** Show a folder and its scenarios with optional name filter */
    public function show(ScenarioFolder $folder, Request $req, TestScenarioRepository $scenarios): Response
    {
        $q = trim((string) $req->query->get('q', ''));
        $items = $scenarios->searchByFolderAndName($folder, $q);
        return $this->render('folder/show.html.twig', [
            'folder' => $folder,
            'scenarios' => $items,
            'q' => $q,
        ]);
    }
    #[Route('/', name: 'folder_index', methods: ['GET'])]
    /** List all folders */
    public function index(ScenarioFolderRepository $repo): Response
    {
        return $this->render('folder/index.html.twig', [
            'folders' => $repo->findAll(),
        ]);
    }

    #[Route('/new', name: 'folder_new', methods: ['GET','POST'])]
    /** Create a new folder */
    public function new(Request $req, EntityManagerInterface $em): Response
    {
        $folder = new ScenarioFolder();
        $form = $this->createForm(ScenarioFolderType::class, $folder);
        $form->handleRequest($req);
        if ($form->isSubmitted() && $form->isValid()) {
            $em->persist($folder);
            $em->flush();
            return $this->redirectToRoute('folder_index');
        }
        return $this->render('folder/new.html.twig', ['form' => $form->createView()]);
    }

    #[Route('/{id}/edit', name: 'folder_edit', methods: ['GET','POST'])]
    /** Edit an existing folder */
    public function edit(ScenarioFolder $folder, Request $req, EntityManagerInterface $em): Response
    {
        $form = $this->createForm(ScenarioFolderType::class, $folder);
        $form->handleRequest($req);
        if ($form->isSubmitted() && $form->isValid()) {
            $em->flush();
            return $this->redirectToRoute('folder_index');
        }
        return $this->render('folder/edit.html.twig', ['form' => $form->createView(), 'folder' => $folder]);
    }

    #[Route('/{id}/delete', name: 'folder_delete', methods: ['POST'])]
    /** Delete a folder */
    public function delete(ScenarioFolder $folder, EntityManagerInterface $em, Request $req): Response
    {
        if ($this->isCsrfTokenValid('del_folder_'.$folder->getId(), $req->request->get('_token'))) {
            $em->remove($folder);
            $em->flush();
        }
        return $this->redirectToRoute('folder_index');
    }

    #[Route('/{id}/duplicate', name: 'folder_duplicate', methods: ['POST'])]
    /** Deep-duplicate a folder tree and contained scenarios */
    public function duplicate(ScenarioFolder $folder, FolderDuplicator $duplicator, EntityManagerInterface $em, Request $req): Response
    {
        if (!$this->isCsrfTokenValid('dup_folder_'.$folder->getId(), $req->request->get('_token'))) {
            return $this->redirectToRoute('folder_show', ['id' => $folder->getId()]);
        }
        $copy = $duplicator->duplicate($folder, $em);
        return $this->redirectToRoute('folder_show', ['id' => $copy->getId()]);
    }
}
