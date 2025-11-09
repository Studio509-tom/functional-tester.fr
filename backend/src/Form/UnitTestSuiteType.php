<?php

declare(strict_types=1);

namespace App\Form;

use App\Entity\UnitTestSuite;
use App\Entity\ScenarioFolder;
use App\Repository\ScenarioFolderRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bridge\Doctrine\Form\Type\EntityType;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\TextareaType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;

class UnitTestSuiteType extends AbstractType
{
    public function __construct(
        private readonly ScenarioFolderRepository $folderRepo,
        private readonly EntityManagerInterface $em,
    ) {}

    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('name', TextType::class)
            ->add('folder', EntityType::class, [
                'class' => ScenarioFolder::class,
                'choice_label' => 'name',
                'required' => false,
                'placeholder' => '— Aucun dossier —',
                'label' => 'Dossier',
            ])
            ->add('testsJson', TextareaType::class, [
                'attr' => [
                    'rows' => 16,
                    'class' => 'font-monospace unit-tests-editor',
                    'placeholder' => json_encode([
                        [
                            'name' => 'GET dashboard returns 200',
                            'method' => 'GET',
                            'url' => '/',
                            'assert' => [ 'status' => 200, 'contains' => 'Functional Tester' ]
                        ]
                    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
                ],
            ]);
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults(['data_class' => UnitTestSuite::class]);
    }

    private function ensureDefaultFolders(array $names): void
    {
        $created = false;
        foreach ($names as $n) {
            $exists = $this->folderRepo->findOneBy(['name' => $n]);
            if (!$exists) {
                $f = new ScenarioFolder();
                $f->setName($n);
                $this->em->persist($f);
                $created = true;
            }
        }
        if ($created) {
            $this->em->flush();
        }
    }

    private function ensureSubfoldersForParent(ScenarioFolder $parent): void
    {
        $createdSubfolders = $parent->ensureTestSubfolders();
        foreach ($createdSubfolders as $subfolder) {
            $this->em->persist($subfolder);
        }
        $this->em->flush();
    }
}
