<?php

declare(strict_types=1);

namespace App\Form;

use App\Entity\UnitTestSuite;
use App\Entity\ScenarioFolder;
use Symfony\Bridge\Doctrine\Form\Type\EntityType;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\TextareaType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;

class UnitTestSuiteType extends AbstractType
{
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
}
